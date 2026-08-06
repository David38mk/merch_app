"""Designer earnings — DERIVED from completed collaborations + orders (never a
stored ledger, so it can't drift from the source facts).

Two earning sources per completed collaboration:
  • Fixed fee (agreed_price_amount): PENDING until the seller completes the
    collab payment (a PAYMENT_COMPLETED event), then AVAILABLE.
  • Revenue share (agreed_percent): agreed % × each paid order line of the
    collab's product. PENDING while the order isn't delivered, AVAILABLE once it
    is. The full (100%) line revenue feeds "lifetime revenue" (sales generated).

Available balance = released earnings − payouts already requested/paid.
"""
from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.commerce import Order, OrderItem
from app.models.enums import CollabEventType, CollabState, PayoutStatus
from app.models.hiring import Collaboration, DesignerCall
from app.models.shop import ShopItem
from app.models.user import Payout, SellerProfile

Q2 = Decimal("0.01")


def _money(d: Decimal) -> Decimal:
    return (d or Decimal(0)).quantize(Q2)


@dataclass
class ProjectEarning:
    collaboration_id: str
    seller: str
    product: str | None
    payment_type: str          # FIXED | PERCENT | BOTH
    amount_earned: Decimal     # the designer's cut booked so far (available + pending)
    available: Decimal
    pending: Decimal
    status: str                # Paid | Pending | Ongoing | Unpaid


@dataclass
class EarningsSummary:
    total_earnings: Decimal = Decimal(0)      # lifetime cut (available + pending), pre-withdrawal
    available_balance: Decimal = Decimal(0)   # withdrawable now (released − payouts)
    pending_balance: Decimal = Decimal(0)     # earned but on hold
    lifetime_revenue: Decimal = Decimal(0)    # gross sales the designer's designs generated
    withdrawn: Decimal = Decimal(0)           # sum of non-failed payouts
    projects: list[ProjectEarning] = field(default_factory=list)


def _payment_type(price: Decimal | None, percent: Decimal | None) -> str:
    if price and percent:
        return "BOTH"
    if percent:
        return "PERCENT"
    return "FIXED"


def compute_earnings(db: Session, designer_profile_id) -> EarningsSummary:
    collabs = db.scalars(
        select(Collaboration)
        .where(
            Collaboration.designer_profile_id == designer_profile_id,
            Collaboration.state == CollabState.COMPLETED,
        )
        .options(selectinload(Collaboration.events))
        .order_by(Collaboration.created_at.desc())
    ).all()

    summary = EarningsSummary()

    for collab in collabs:
        call = db.get(DesignerCall, collab.call_id)
        seller = db.get(SellerProfile, collab.seller_profile_id)
        product = db.get(ShopItem, collab.shop_item_id) if collab.shop_item_id else None

        avail = Decimal(0)
        pend = Decimal(0)

        # ── fixed fee ──
        fixed = collab.agreed_price_amount or Decimal(0)
        if fixed:
            paid = any(e.type == CollabEventType.PAYMENT_COMPLETED for e in collab.events)
            if paid:
                avail += fixed
            else:
                pend += fixed

        # ── revenue share (from the linked product's paid sales) ──
        percent = collab.agreed_percent or Decimal(0)
        if percent and product is not None:
            lines = db.execute(
                select(OrderItem.unit_price_at_purchase, OrderItem.quantity, Order.delivered_at)
                .join(Order, OrderItem.order_id == Order.id)
                .where(OrderItem.shop_item_id == product.id, Order.paid_at.isnot(None))
            ).all()
            for unit_price, qty, delivered_at in lines:
                gross = (unit_price or Decimal(0)) * qty
                summary.lifetime_revenue += gross
                share = gross * percent / Decimal(100)
                if delivered_at is not None:
                    avail += share
                else:
                    pend += share

        summary.available_balance += avail  # released gross (payouts subtracted below)
        summary.pending_balance += pend

        earned = _money(avail + pend)
        if earned <= 0 and not (fixed and percent):
            # nothing booked yet for a pure percent project with no sales — still list it
            pass
        status = (
            "Paid" if pend == 0 and avail > 0
            else "Pending" if avail == 0 and pend > 0
            else "Ongoing" if avail > 0 and pend > 0
            else "Unpaid"
        )
        summary.projects.append(
            ProjectEarning(
                collaboration_id=str(collab.id),
                seller=(seller.store_name if seller and seller.store_name else "A seller"),
                product=(product.name if product else (call.title if call else None)),
                payment_type=_payment_type(collab.agreed_price_amount, collab.agreed_percent),
                amount_earned=earned,
                available=_money(avail),
                pending=_money(pend),
                status=status,
            )
        )

    # ── payouts reduce the withdrawable balance ──
    payouts = db.scalars(
        select(Payout).where(Payout.designer_profile_id == designer_profile_id)
    ).all()
    withdrawn = sum(
        (p.amount for p in payouts if p.status != PayoutStatus.FAILED), Decimal(0)
    )
    summary.withdrawn = _money(withdrawn)

    released = summary.available_balance
    summary.total_earnings = _money(summary.available_balance + summary.pending_balance)
    summary.available_balance = _money(max(Decimal(0), released - withdrawn))
    summary.pending_balance = _money(summary.pending_balance)
    summary.lifetime_revenue = _money(summary.lifetime_revenue)
    return summary
