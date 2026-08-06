"""Orders: public buy-now checkout (stub payment), the seller's Orders page, and
the print shop's production queue that drives fulfillment.

Status model — two stored facts, one derived truth:
  Order.status            money facts   (PENDING / PAID / CANCELLED / REFUNDED)
  OrderItem.fulfillment   production facts per line (PAID → IN_PRODUCTION → SHIPPED → DELIVERED)
The 7 statuses sellers see are derived from both (`display_status`), so the
order can never disagree with its own items. Every transition appends an
OrderEvent — the timeline the seller reads.
"""

import uuid
from datetime import date, datetime, time, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_optional_user, require_role
from app.core.config import settings
from app.core.database import get_db
from app.core.discounts import resolve_discount
from app.core.notify import push
from app.core.pricing import SHIPPING_METHODS, commission_rate, delivery_window, order_totals
from app.core.security import create_confirm_token
from app.seams.delivery import send_order_confirmation
from app.models.catalog import BaseItem, BaseItemVariant
from app.models.commerce import Order, OrderEvent, OrderItem
from app.models.design import Design
from app.models.enums import (
    FulfillmentStatus,
    NotificationType,
    OrderEventType,
    OrderStatus,
    Role,
    ShopItemState,
    StoreState,
)
from app.models.shop import ShopItem
from app.models.user import PrintShopProfile, SellerProfile, User, UserRole
from app.seams.payments import charge_order

public = APIRouter(prefix="/store", tags=["checkout"])
router = APIRouter(prefix="/orders", tags=["orders"])
production = APIRouter(prefix="/production", tags=["printshop"])
buyer = APIRouter(prefix="/buyer", tags=["buyer"])


# ── derived status ────────────────────────────────────────────────────────────

# Ranks for aggregating line statuses ("the order is as far along as its
# slowest line", except delivery which needs every line done).
_RANK = {
    FulfillmentStatus.PAID: 0,
    FulfillmentStatus.IN_PRODUCTION: 1,
    FulfillmentStatus.QUALITY_CHECK: 1,  # still "In production" to the 7-status view
    FulfillmentStatus.HANDED_TO_SHIPMENT: 2,  # legacy value, treated as shipped
    FulfillmentStatus.SHIPPED: 2,
    FulfillmentStatus.DELIVERED: 3,
}

DISPLAY_STATUSES = (
    "PENDING_PAYMENT", "PAID", "IN_PRODUCTION", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED",
)


def display_status(order: Order) -> str:
    if order.status == OrderStatus.CANCELLED:
        return "CANCELLED"
    if order.status == OrderStatus.REFUNDED:
        return "REFUNDED"
    if order.status == OrderStatus.PENDING:
        return "PENDING_PAYMENT"
    ranks = [_RANK[i.fulfillment_status] for i in order.items] or [0]
    if min(ranks) >= 3:
        return "DELIVERED"
    if min(ranks) >= 2:
        return "SHIPPED"
    if max(ranks) >= 1:
        return "IN_PRODUCTION"
    return "PAID"


def _log(db: Session, order: Order, type_: OrderEventType, note: str | None = None) -> None:
    db.add(OrderEvent(order_id=order.id, type=type_, note=note))


def short_id(order_id: uuid.UUID) -> str:
    return order_id.hex[:8].upper()


_LOADERS = (
    selectinload(Order.items),
    selectinload(Order.events),
)


# ── schemas ──────────────────────────────────────────────────────────────────

class CheckoutIn(BaseModel):
    shop_item_id: uuid.UUID
    color: str
    size: str
    quantity: int = Field(default=1, ge=1, le=50)
    name: str = Field(min_length=1)
    email: EmailStr
    address: str = Field(min_length=1)
    city: str = Field(min_length=1)
    postal: str = Field(min_length=1)
    country: str = Field(min_length=1)
    discount_code: str | None = None
    phone: str | None = None
    apartment: str | None = None
    shipping_method: str = "standard"
    idempotency_key: str | None = None
    # Non-sensitive card display only (PCI-safe) — never the PAN/CVV/expiry.
    card_brand: str | None = None
    card_last4: str | None = None


class CartLine(BaseModel):
    shop_item_id: uuid.UUID
    color: str
    size: str
    quantity: int = Field(default=1, ge=1, le=50)


class CartCheckoutIn(BaseModel):
    """Multi-line checkout for one brand's cart (orders are per-seller). The cart
    page groups items by brand and calls this once per brand."""
    items: list[CartLine] = Field(min_length=1)
    name: str = Field(min_length=1)
    email: EmailStr
    address: str = Field(min_length=1)
    city: str = Field(min_length=1)
    postal: str = Field(min_length=1)
    country: str = Field(min_length=1)
    discount_code: str | None = None
    phone: str | None = None
    apartment: str | None = None
    shipping_method: str = "standard"
    # A repeat submit with the same key returns the first order (dedup).
    idempotency_key: str | None = None
    card_brand: str | None = None
    card_last4: str | None = None


class CheckoutOut(BaseModel):
    order_id: uuid.UUID
    short_id: str
    total: Decimal
    status: str
    # Guest-safe link token for the order-confirmation page.
    confirmation_token: str = ""


class OrderItemOut(BaseModel):
    id: uuid.UUID
    name: str
    quantity: int
    unit_price: Decimal
    production_cost: Decimal | None = None  # per unit, snapshotted at purchase
    color: str | None = None
    size: str | None = None
    base_image_url: str | None = None
    design_url: str | None = None
    # Placement snapshot — renders the mockup the buyer actually bought.
    pos_x: float = 50
    pos_y: float = 45
    scale: float = 0.45
    rotation: float = 0
    fulfillment_status: str


class EventOut(BaseModel):
    type: str
    note: str | None
    created_at: datetime


class OrderListItem(BaseModel):
    id: uuid.UUID
    short_id: str
    customer_name: str
    product_summary: str  # "Cosmic Tee ×2 + 1 more"
    created_at: datetime
    total: Decimal
    earnings: Decimal
    status: str


class OrderCounts(BaseModel):
    PENDING_PAYMENT: int = 0
    PAID: int = 0
    IN_PRODUCTION: int = 0
    SHIPPED: int = 0
    DELIVERED: int = 0
    CANCELLED: int = 0
    REFUNDED: int = 0


class OrderList(BaseModel):
    items: list[OrderListItem]
    counts: OrderCounts


class OrderDetail(BaseModel):
    id: uuid.UUID
    short_id: str
    status: str
    created_at: datetime
    # customer
    customer_name: str
    customer_email: str | None
    # money
    subtotal: Decimal
    commission_rate: Decimal
    commission_amount: Decimal
    production_total: Decimal
    earnings: Decimal
    payment_method: str
    paid_at: datetime | None
    # shipping
    ship_name: str | None
    ship_address: str | None
    ship_city: str | None
    ship_postal: str | None
    ship_country: str | None
    tracking_number: str | None
    # content
    items: list[OrderItemOut]
    events: list[EventOut]
    can_cancel: bool
    can_refund: bool


class QueueItem(BaseModel):
    id: uuid.UUID  # order item id
    order_short_id: str
    product_name: str
    color: str | None
    size: str | None
    quantity: int
    base_image_url: str | None = None
    design_url: str | None = None
    store_name: str | None
    status: str
    next_action: str | None  # what advancing does, None when done
    created_at: datetime


class QueueOut(BaseModel):
    items: list[QueueItem]
    to_produce: int
    in_production: int
    shipped: int


class AdvanceIn(BaseModel):
    tracking_number: str | None = None


# ── buyer-facing order schemas (no seller economics) ──────────────────────────

class BuyerOrderListItem(BaseModel):
    id: uuid.UUID
    short_id: str
    store_name: str | None
    store_slug: str | None
    product_summary: str
    thumbnail_url: str | None = None  # first line's design/base image
    item_count: int
    total: Decimal  # what the buyer paid
    created_at: datetime
    status: str
    tracking_number: str | None = None


class BuyerOrderList(BaseModel):
    items: list[BuyerOrderListItem]


class BuyerOrderDetail(BaseModel):
    id: uuid.UUID
    short_id: str
    status: str
    created_at: datetime
    store_name: str | None
    store_slug: str | None
    # money breakdown the buyer paid
    subtotal: Decimal
    discount_amount: Decimal
    discount_code: str | None
    shipping_amount: Decimal
    tax_amount: Decimal
    total: Decimal
    ship_name: str | None
    ship_address: str | None
    ship_city: str | None
    ship_postal: str | None
    ship_country: str | None
    tracking_number: str | None
    items: list[OrderItemOut]
    events: list[EventOut]


# ── helpers ──────────────────────────────────────────────────────────────────

def _buyer_for(db: Session, name: str, email: str) -> User:
    """Find-or-create a lightweight buyer account (passwordless, BUYER role) so
    orders always reference a real user and repeat buyers aggregate."""
    user = db.scalar(select(User).where(User.email == email.lower()))
    if user is not None:
        return user
    user = User(
        email=email.lower(),
        password_hash=None,
        first_name=name.split(" ")[0],
        last_name=" ".join(name.split(" ")[1:]),
        display_name=name,
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role=Role.BUYER))
    return user


def _resolve_totals(db: Session, seller: SellerProfile, subtotal: Decimal, code: str | None, method: str = "standard"):
    """Resolve a discount code (400 on an invalid one) and compute the buyer
    money breakdown for the chosen shipping method. Returns (row, totals)."""
    if method not in SHIPPING_METHODS:
        method = "standard"
    row, amount, error = resolve_discount(db, code, seller.id, subtotal)
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    return row, order_totals(subtotal, amount, method)


def _full_address(address: str, apartment: str | None) -> str:
    apt = (apartment or "").strip()
    return f"{address.strip()}, {apt}" if apt else address.strip()


def _confirmation(order: Order) -> str:
    return create_confirm_token(str(order.id))


def _idempotent_hit(db: Session, key: str | None) -> Order | None:
    """Return the order already created under this key, if any (dedup)."""
    if not key:
        return None
    return db.scalar(select(Order).where(Order.idempotency_key == key))


def _last4(value: str | None) -> str | None:
    digits = "".join(c for c in (value or "") if c.isdigit())
    return digits[-4:] if len(digits) >= 4 else None


def _delivery(method: str) -> tuple[date, date]:
    return delivery_window(date.today(), method if method in SHIPPING_METHODS else "standard")


def _item_out(db: Session, it: OrderItem) -> OrderItemOut:
    shop_item = db.get(ShopItem, it.shop_item_id)
    variant = db.get(BaseItemVariant, it.base_item_variant_id)
    base = db.get(BaseItem, shop_item.base_item_id) if shop_item else None
    design = db.get(Design, shop_item.design_id) if shop_item and shop_item.design_id else None
    return OrderItemOut(
        id=it.id,
        name=it.name_at_purchase or (shop_item.name if shop_item else "Product"),
        quantity=it.quantity,
        unit_price=it.unit_price_at_purchase,
        production_cost=it.production_cost_at_purchase,
        color=variant.color if variant else None,
        size=variant.size if variant else None,
        base_image_url=base.image_url if base else None,
        design_url=design.resource_url if design else None,
        pos_x=it.pos_x if it.pos_x is not None else (shop_item.pos_x if shop_item else 50),
        pos_y=it.pos_y if it.pos_y is not None else (shop_item.pos_y if shop_item else 45),
        scale=it.scale if it.scale is not None else (shop_item.scale if shop_item else 0.45),
        rotation=it.rotation if it.rotation is not None else (shop_item.rotation if shop_item else 0),
        fulfillment_status=it.fulfillment_status.value,
    )


def _customer(db: Session, order: Order) -> tuple[str, str | None]:
    buyer = db.get(User, order.buyer_user_id)
    name = order.ship_name or (buyer.display_name if buyer else "Customer")
    return name, (buyer.email if buyer else None)


def _seller_profile(db: Session, user: User) -> SellerProfile:
    p = db.scalar(select(SellerProfile).where(SellerProfile.user_id == user.id))
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No seller profile.")
    return p


def _own_order(db: Session, profile: SellerProfile, order_id: uuid.UUID) -> Order:
    # populate_existing: this runs right after commits, and without it SQLAlchemy
    # hands back the identity-mapped order with its STALE events collection.
    order = db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(*_LOADERS)
        .execution_options(populate_existing=True)
    )
    if order is None or order.seller_profile_id != profile.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
    return order


def _can_cancel(order: Order) -> bool:
    """Only before any line entered production — after that materials are cut."""
    return order.status in (OrderStatus.PENDING, OrderStatus.PAID) and all(
        _RANK[i.fulfillment_status] == 0 for i in order.items
    )


def _can_refund(order: Order) -> bool:
    return order.status == OrderStatus.PAID


# ── public checkout ──────────────────────────────────────────────────────────

@public.post("/{slug}/checkout", response_model=CheckoutOut, status_code=status.HTTP_201_CREATED)
def checkout(
    slug: str,
    payload: CheckoutIn,
    db: Session = Depends(get_db),
    current: User | None = Depends(get_optional_user),
) -> CheckoutOut:
    """Buy-now with a stubbed payment (seam #3): the order is created and marked
    paid in one step. Replacing the stub with Stripe later only swaps the
    charge call — the order shape stays."""
    # Duplicate-submit guard: a repeat with the same key returns the first order.
    dup = _idempotent_hit(db, payload.idempotency_key)
    if dup is not None:
        return CheckoutOut(
            order_id=dup.id, short_id=short_id(dup.id), total=dup.total_amount,
            status="PAID", confirmation_token=_confirmation(dup),
        )

    seller = db.scalar(select(SellerProfile).where(SellerProfile.slug == slug))
    if seller is None or seller.store_state != StoreState.LIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storefront not found.")

    item = db.get(ShopItem, payload.shop_item_id)
    if item is None or item.seller_profile_id != seller.id or item.state != ShopItemState.LISTED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That product isn't available.")

    base = db.scalar(
        select(BaseItem)
        .where(BaseItem.id == item.base_item_id)
        .options(selectinload(BaseItem.variants), selectinload(BaseItem.print_shop))
    )
    variant = next(
        (v for v in base.variants if v.color == payload.color and v.size == payload.size and v.is_available),
        None,
    )
    if variant is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{item.name} isn't available in {payload.color} / {payload.size}.",
        )

    # A logged-in buyer's order attaches to their account (so it lands in their
    # dashboard) regardless of the email typed; guests get a find-or-create account.
    buyer = current if current is not None else _buyer_for(db, payload.name.strip(), payload.email)
    rate = commission_rate(seller.plan_code)
    subtotal = (Decimal(item.price) * payload.quantity).quantize(Decimal("0.01"))
    commission = (subtotal * rate).quantize(Decimal("0.01"))
    # Payout honours the product calculator's promise: revenue minus what the
    # print run costs minus the platform fee. Shipping/tax/discount are
    # buyer-facing and platform-absorbed — they never touch the payout.
    production_total = (Decimal(item.production_cost) * payload.quantity).quantize(Decimal("0.01"))
    disc_row, totals = _resolve_totals(db, seller, subtotal, payload.discount_code, payload.shipping_method)

    order = Order(
        buyer_user_id=buyer.id,
        seller_profile_id=seller.id,
        status=OrderStatus.PENDING,
        subtotal=subtotal,
        commission_rate=rate,
        commission_amount=commission,
        seller_payout_amount=subtotal - commission - production_total,
        discount_amount=totals["discount"],
        discount_code=disc_row.code if disc_row else None,
        shipping_amount=totals["shipping"],
        tax_amount=totals["tax"],
        total_amount=totals["total"],
        shipping_method=payload.shipping_method,
        idempotency_key=payload.idempotency_key,
        card_brand=(payload.card_brand or "").strip() or None,
        card_last4=_last4(payload.card_last4),
        est_delivery_from=_delivery(payload.shipping_method)[0],
        est_delivery_to=_delivery(payload.shipping_method)[1],
        ship_name=payload.name.strip(),
        ship_phone=(payload.phone or "").strip() or None,
        ship_address=_full_address(payload.address, payload.apartment),
        ship_city=payload.city.strip(),
        ship_postal=payload.postal.strip(),
        ship_country=payload.country.strip(),
    )
    if disc_row:
        disc_row.used_count += 1
    db.add(order)
    db.flush()
    db.add(
        OrderItem(
            order_id=order.id,
            shop_item_id=item.id,
            base_item_variant_id=variant.id,
            print_shop_profile_id=base.print_shop_profile_id,
            quantity=payload.quantity,
            unit_price_at_purchase=item.price,
            name_at_purchase=item.name,
            production_cost_at_purchase=item.production_cost,
            pos_x=item.pos_x,
            pos_y=item.pos_y,
            scale=item.scale,
            rotation=item.rotation,
            fulfillment_status=FulfillmentStatus.PAID,
        )
    )
    _log(db, order, OrderEventType.PLACED, f"Order placed by {payload.name.strip()}")

    # 🔌 payment seam — charges the full total (subtotal − discount + shipping + tax).
    charge_order(str(order.id), float(totals["total"]))
    order.status = OrderStatus.PAID
    order.paid_at = datetime.now(timezone.utc)
    order.stripe_payment_intent_id = f"stub_{order.id.hex[:16]}"
    _log(db, order, OrderEventType.PAID, "Payment received (test payment)")
    # Paid = queued at the provider; that's the moment the shop can see it.
    provider = db.get(PrintShopProfile, base.print_shop_profile_id)
    _log(
        db, order, OrderEventType.SENT_TO_PROVIDER,
        f"Sent to {provider.name}" if provider else "Sent to the print provider",
    )

    # Tell both sides work exists.
    push(
        db, seller.user_id, NotificationType.SALE,
        f"New order · €{totals['total']}",
        f"{payload.name.strip()} bought {item.name} ×{payload.quantity}.",
        link_url=f"/seller/orders/{order.id}",
    )
    if provider:
        push(
            db, provider.user_id, NotificationType.NEW_PRODUCTION_ORDER,
            "New production order",
            f"{item.name} ×{payload.quantity} ({variant.color}/{variant.size}) is paid and ready to produce.",
            link_url="/printshop",
        )
    # Buyer side: in-app only — checkout already emails the confirmation receipt.
    push(
        db, buyer.id, NotificationType.ORDER, "Order confirmed 🎉",
        f"We got your order #{short_id(order.id)} — we'll let you know as it ships.",
        link_url=f"/orders/{order.id}", email=False,
    )

    db.commit()
    token = _confirmation(order)
    send_order_confirmation(payload.email, short_id(order.id), str(totals["total"]),
                            f"{settings.FRONTEND_ORIGIN}/order/confirmed/{token}")
    return CheckoutOut(
        order_id=order.id, short_id=short_id(order.id), total=totals["total"],
        status="PAID", confirmation_token=token,
    )


@public.post("/{slug}/checkout-cart", response_model=CheckoutOut, status_code=status.HTTP_201_CREATED)
def checkout_cart(
    slug: str,
    payload: CartCheckoutIn,
    db: Session = Depends(get_db),
    current: User | None = Depends(get_optional_user),
) -> CheckoutOut:
    """Check out a whole cart for ONE brand as a single multi-line order. Every
    line is validated for stock before payment (seam #3, stubbed)."""
    dup = _idempotent_hit(db, payload.idempotency_key)
    if dup is not None:
        return CheckoutOut(
            order_id=dup.id, short_id=short_id(dup.id), total=dup.total_amount,
            status="PAID", confirmation_token=_confirmation(dup),
        )

    seller = db.scalar(select(SellerProfile).where(SellerProfile.slug == slug))
    if seller is None or seller.store_state != StoreState.LIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storefront not found.")

    # Resolve every line first — if any is unavailable, fail the whole cart with a
    # clear message rather than charging for a partial order.
    resolved = []  # (item, base, variant, qty)
    for line in payload.items:
        item = db.get(ShopItem, line.shop_item_id)
        if item is None or item.seller_profile_id != seller.id or item.state != ShopItemState.LISTED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A product in your cart isn't available.")
        base = db.scalar(
            select(BaseItem).where(BaseItem.id == item.base_item_id).options(selectinload(BaseItem.variants))
        )
        variant = next(
            (v for v in base.variants if v.color == line.color and v.size == line.size and v.is_available), None
        )
        if variant is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{item.name} isn't available in {line.color} / {line.size}.",
            )
        resolved.append((item, base, variant, line.quantity))

    buyer = current if current is not None else _buyer_for(db, payload.name.strip(), payload.email)
    rate = commission_rate(seller.plan_code)
    subtotal = sum((Decimal(i.price) * q for i, _, _, q in resolved), Decimal("0")).quantize(Decimal("0.01"))
    commission = (subtotal * rate).quantize(Decimal("0.01"))
    production_total = sum(
        (Decimal(i.production_cost) * q for i, _, _, q in resolved), Decimal("0")
    ).quantize(Decimal("0.01"))
    disc_row, totals = _resolve_totals(db, seller, subtotal, payload.discount_code, payload.shipping_method)

    order = Order(
        buyer_user_id=buyer.id,
        seller_profile_id=seller.id,
        status=OrderStatus.PENDING,
        subtotal=subtotal,
        commission_rate=rate,
        commission_amount=commission,
        seller_payout_amount=subtotal - commission - production_total,
        discount_amount=totals["discount"],
        discount_code=disc_row.code if disc_row else None,
        shipping_amount=totals["shipping"],
        tax_amount=totals["tax"],
        total_amount=totals["total"],
        shipping_method=payload.shipping_method,
        idempotency_key=payload.idempotency_key,
        card_brand=(payload.card_brand or "").strip() or None,
        card_last4=_last4(payload.card_last4),
        est_delivery_from=_delivery(payload.shipping_method)[0],
        est_delivery_to=_delivery(payload.shipping_method)[1],
        ship_name=payload.name.strip(),
        ship_phone=(payload.phone or "").strip() or None,
        ship_address=_full_address(payload.address, payload.apartment),
        ship_city=payload.city.strip(),
        ship_postal=payload.postal.strip(),
        ship_country=payload.country.strip(),
    )
    if disc_row:
        disc_row.used_count += 1
    db.add(order)
    db.flush()
    for item, base, variant, qty in resolved:
        db.add(
            OrderItem(
                order_id=order.id,
                shop_item_id=item.id,
                base_item_variant_id=variant.id,
                print_shop_profile_id=base.print_shop_profile_id,
                quantity=qty,
                unit_price_at_purchase=item.price,
                name_at_purchase=item.name,
                production_cost_at_purchase=item.production_cost,
                pos_x=item.pos_x, pos_y=item.pos_y, scale=item.scale, rotation=item.rotation,
                fulfillment_status=FulfillmentStatus.PAID,
            )
        )
    _log(db, order, OrderEventType.PLACED, f"Order placed by {payload.name.strip()}")

    charge_order(str(order.id), float(totals["total"]))  # 🔌 payment seam — charges the full total
    order.status = OrderStatus.PAID
    order.paid_at = datetime.now(timezone.utc)
    order.stripe_payment_intent_id = f"stub_{order.id.hex[:16]}"
    _log(db, order, OrderEventType.PAID, "Payment received (test payment)")

    # Notify each distinct print provider about the lines they'll produce.
    providers = {b.print_shop_profile_id for _, b, _, _ in resolved}
    provider_names = []
    for pid in providers:
        prov = db.get(PrintShopProfile, pid)
        if prov:
            provider_names.append(prov.name)
            push(
                db, prov.user_id, NotificationType.NEW_PRODUCTION_ORDER,
                "New production order",
                f"{sum(q for i, b, v, q in resolved if b.print_shop_profile_id == pid)} item(s) paid and ready to produce.",
                link_url="/printshop",
            )
    _log(
        db, order, OrderEventType.SENT_TO_PROVIDER,
        f"Sent to {', '.join(provider_names)}" if provider_names else "Sent to the print provider",
    )

    n_items = sum(q for _, _, _, q in resolved)
    push(
        db, seller.user_id, NotificationType.SALE,
        f"New order · €{totals['total']}",
        f"{payload.name.strip()} bought {n_items} item(s).",
        link_url=f"/seller/orders/{order.id}",
    )
    push(
        db, buyer.id, NotificationType.ORDER, "Order confirmed 🎉",
        f"We got your order #{short_id(order.id)} — we'll let you know as it ships.",
        link_url=f"/orders/{order.id}", email=False,
    )

    db.commit()
    token = _confirmation(order)
    send_order_confirmation(payload.email, short_id(order.id), str(totals["total"]),
                            f"{settings.FRONTEND_ORIGIN}/order/confirmed/{token}")
    return CheckoutOut(
        order_id=order.id, short_id=short_id(order.id), total=totals["total"],
        status="PAID", confirmation_token=token,
    )


# ── seller orders ────────────────────────────────────────────────────────────

SORTS = {
    "date_desc": lambda o: o.created_at,
    "date_asc": lambda o: o.created_at,
    "total_desc": lambda o: o.subtotal,
    "total_asc": lambda o: o.subtotal,
    "earnings_desc": lambda o: o.seller_payout_amount,
}


@router.get("", response_model=OrderList)
def list_orders(
    q: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    date_from: date | None = None,
    date_to: date | None = None,
    sort: str = "date_desc",
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> OrderList:
    profile = _seller_profile(db, user)
    orders = db.scalars(
        select(Order)
        .where(Order.seller_profile_id == profile.id)
        .options(*_LOADERS)
        .order_by(Order.created_at.desc())
    ).all()

    # Display status is derived (money + production facts), so filtering and
    # counting happen after derivation — in one place, on the server.
    counts = OrderCounts()
    enriched = []
    for o in orders:
        ds = display_status(o)
        setattr(counts, ds, getattr(counts, ds) + 1)
        enriched.append((o, ds))

    if status_filter:
        if status_filter not in DISPLAY_STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown status.")
        enriched = [(o, ds) for o, ds in enriched if ds == status_filter]
    if date_from:
        start = datetime.combine(date_from, time.min, tzinfo=timezone.utc)
        enriched = [(o, ds) for o, ds in enriched if o.created_at >= start]
    if date_to:
        end = datetime.combine(date_to, time.max, tzinfo=timezone.utc)
        enriched = [(o, ds) for o, ds in enriched if o.created_at <= end]
    if q:
        needle = q.strip().lower()
        def matches(o: Order) -> bool:
            name, email = _customer(db, o)
            if needle in name.lower() or (email and needle in email.lower()):
                return True
            if needle in short_id(o.id).lower() or needle in o.id.hex.lower():
                return True
            return any(needle in (i.name_at_purchase or "").lower() for i in o.items)
        enriched = [(o, ds) for o, ds in enriched if matches(o)]

    key = SORTS.get(sort, SORTS["date_desc"])
    reverse = not sort.endswith("_asc")
    enriched.sort(key=lambda pair: key(pair[0]), reverse=reverse)

    out = []
    for o, ds in enriched:
        name, _ = _customer(db, o)
        first = o.items[0] if o.items else None
        summary = "—"
        if first:
            summary = f"{first.name_at_purchase or 'Product'} ×{first.quantity}"
            if len(o.items) > 1:
                summary += f" + {len(o.items) - 1} more"
        out.append(
            OrderListItem(
                id=o.id,
                short_id=short_id(o.id),
                customer_name=name,
                product_summary=summary,
                created_at=o.created_at,
                total=o.subtotal,
                earnings=o.seller_payout_amount,
                status=ds,
            )
        )
    return OrderList(items=out, counts=counts)


def _detail(db: Session, order: Order) -> OrderDetail:
    name, email = _customer(db, order)
    return OrderDetail(
        id=order.id,
        short_id=short_id(order.id),
        status=display_status(order),
        created_at=order.created_at,
        customer_name=name,
        customer_email=email,
        subtotal=order.subtotal,
        commission_rate=order.commission_rate,
        commission_amount=order.commission_amount,
        production_total=sum(
            (Decimal(i.production_cost_at_purchase or 0) * i.quantity for i in order.items),
            Decimal("0"),
        ).quantize(Decimal("0.01")),
        earnings=order.seller_payout_amount,
        payment_method="Test payment (stub gateway)" if order.stripe_payment_intent_id else "—",
        paid_at=order.paid_at,
        ship_name=order.ship_name,
        ship_address=order.ship_address,
        ship_city=order.ship_city,
        ship_postal=order.ship_postal,
        ship_country=order.ship_country,
        tracking_number=order.tracking_number,
        items=[_item_out(db, i) for i in order.items],
        events=[EventOut(type=e.type.value, note=e.note, created_at=e.created_at) for e in order.events],
        can_cancel=_can_cancel(order),
        can_refund=_can_refund(order),
    )


@router.get("/{order_id}", response_model=OrderDetail)
def get_order(
    order_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> OrderDetail:
    profile = _seller_profile(db, user)
    return _detail(db, _own_order(db, profile, order_id))


@router.post("/{order_id}/cancel", response_model=OrderDetail)
def cancel_order(
    order_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> OrderDetail:
    profile = _seller_profile(db, user)
    order = _own_order(db, profile, order_id)
    if not _can_cancel(order):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Production has started — refund the order instead of cancelling it.",
        )
    order.status = OrderStatus.CANCELLED
    order.cancelled_at = datetime.now(timezone.utc)
    _log(db, order, OrderEventType.CANCELLED, "Cancelled by the seller before production")
    db.commit()
    return _detail(db, _own_order(db, profile, order_id))


@router.post("/{order_id}/refund", response_model=OrderDetail)
def refund_order(
    order_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> OrderDetail:
    profile = _seller_profile(db, user)
    order = _own_order(db, profile, order_id)
    if not _can_refund(order):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only a paid order can be refunded.")
    # 🔌 payment seam — a real gateway refund goes here.
    order.status = OrderStatus.REFUNDED
    order.refunded_at = datetime.now(timezone.utc)
    _log(db, order, OrderEventType.REFUNDED, f"€{order.subtotal} refunded to the customer (test payment)")
    _notify_seller(
        db, order, f"Refund issued · €{order.subtotal}",
        "was refunded to the customer.", NotificationType.PAYMENT,
    )
    db.commit()
    return _detail(db, _own_order(db, profile, order_id))


# ── print-shop production queue ──────────────────────────────────────────────

_NEXT: dict[FulfillmentStatus, tuple[FulfillmentStatus, str] | None] = {
    FulfillmentStatus.PAID: (FulfillmentStatus.IN_PRODUCTION, "Start production"),
    FulfillmentStatus.IN_PRODUCTION: (FulfillmentStatus.QUALITY_CHECK, "Send to quality check"),
    FulfillmentStatus.QUALITY_CHECK: (FulfillmentStatus.SHIPPED, "Mark shipped"),
    FulfillmentStatus.HANDED_TO_SHIPMENT: (FulfillmentStatus.DELIVERED, "Mark delivered"),
    FulfillmentStatus.SHIPPED: (FulfillmentStatus.DELIVERED, "Mark delivered"),
    FulfillmentStatus.DELIVERED: None,
}


class CarrierOut(BaseModel):
    id: str
    label: str


    return [CarrierOut(id=cid, label=spec["label"]) for cid, spec in CARRIERS.items()]


def _shop_profile(db: Session, user: User) -> PrintShopProfile:
    p = db.scalar(select(PrintShopProfile).where(PrintShopProfile.user_id == user.id))
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No print shop profile.")
    return p


@production.get("/queue", response_model=QueueOut)
def production_queue(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.PRINTSHOP)),
) -> QueueOut:
    shop = _shop_profile(db, user)
    rows = db.scalars(
        select(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .where(
            OrderItem.print_shop_profile_id == shop.id,
            Order.status == OrderStatus.PAID,  # cancelled/refunded orders leave the queue
        )
        .order_by(Order.created_at.asc())
    ).all()

    items: list[QueueItem] = []
    to_produce = in_prod = shipped = 0
    for it in rows:
        order = db.get(Order, it.order_id)
        seller = db.get(SellerProfile, order.seller_profile_id)
        rank = _RANK[it.fulfillment_status]
        if rank == 0:
            to_produce += 1
        elif rank == 1:
            in_prod += 1
        elif rank == 2:
            shipped += 1
        nxt = _NEXT[it.fulfillment_status]
        base_out = _item_out(db, it)
        items.append(
            QueueItem(
                id=it.id,
                order_short_id=short_id(order.id),
                product_name=base_out.name,
                color=base_out.color,
                size=base_out.size,
                quantity=it.quantity,
                base_image_url=base_out.base_image_url,
                design_url=base_out.design_url,
                store_name=seller.store_name if seller else None,
                status=it.fulfillment_status.value,
                next_action=nxt[1] if nxt else None,
                created_at=order.created_at,
            )
        )
    return QueueOut(items=items, to_produce=to_produce, in_production=in_prod, shipped=shipped)


@production.post("/items/{item_id}/advance", response_model=QueueOut)
def advance_item(
    item_id: uuid.UUID,
    payload: AdvanceIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.PRINTSHOP)),
) -> QueueOut:
    """Move a line one step forward. The seller's order status, timeline and
    notifications all follow automatically — this is the 'provider updates,
    order updates' contract from the ticket."""
    shop = _shop_profile(db, user)
    it = db.get(OrderItem, item_id)
    if it is None or it.print_shop_profile_id != shop.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Queue item not found.")
    order = db.scalar(select(Order).where(Order.id == it.order_id).options(*_LOADERS))
    if order.status != OrderStatus.PAID:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This order is no longer active.")
    nxt = _NEXT[it.fulfillment_status]
    if nxt is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already delivered.")

    before = display_status(order)
    it.fulfillment_status = nxt[0]
    if nxt[0] == FulfillmentStatus.SHIPPED:
        if payload.tracking_number:
            order.tracking_number = payload.tracking_number.strip()

    # Quality check doesn't move the 7-status aggregate (still "In production"),
    # so it's logged on the first line entering QC rather than on a status flip.
    if nxt[0] == FulfillmentStatus.QUALITY_CHECK and not any(
        e.type == OrderEventType.QUALITY_CHECK for e in order.events
    ):
        _log(db, order, OrderEventType.QUALITY_CHECK, "In quality check at the print shop")

    # Order-level transitions fire exactly when the AGGREGATE moves — one event
    # per stage, no matter how many lines an order has.
    after = display_status(order)
    if after != before:
        now = datetime.now(timezone.utc)
        if after == "IN_PRODUCTION":
            _log(db, order, OrderEventType.IN_PRODUCTION, "The print shop started production")
            _notify_seller(db, order, "Order in production", "is now being produced.")
        elif after == "SHIPPED":
            order.shipped_at = now
            bits = [b for b in (f"via {label}" if label else None,
                                f"Tracking: {order.tracking_number}" if order.tracking_number else None) if b]
            _log(db, order, OrderEventType.SHIPPED, " · ".join(bits) or None)
            _notify_seller(db, order, "Order shipped", "has been shipped.")
            push(
                db, order.buyer_user_id, NotificationType.ORDER, "Your order shipped 📦",
                f"Order #{short_id(order.id)} is on its way. " + (" · ".join(bits) if bits else "It's on its way."),
                link_url=f"/orders/{order.id}",
            )
        elif after == "DELIVERED":
            order.delivered_at = now
            _log(db, order, OrderEventType.DELIVERED, None)
            _notify_seller(db, order, "Order delivered", "was delivered to the customer.")
            push(
                db, order.buyer_user_id, NotificationType.ORDER, "Your order was delivered ✅",
                f"Order #{short_id(order.id)} was delivered — we hope you love it!",
                link_url=f"/orders/{order.id}",
            )
            # Review request — now that the line is DELIVERED the buyer can review.
            review_link = (
                f"/p/{order.items[0].shop_item_id}#reviews" if len(order.items) == 1
                else f"/orders/{order.id}"
            )
            push(
                db, order.buyer_user_id, NotificationType.REVIEW, "How was your order? ⭐",
                "Share a quick review to help other buyers — it only takes a minute.",
                link_url=review_link, email=False,
            )

    db.commit()
    return production_queue(db=db, user=user)


def _notify_seller(
    db: Session,
    order: Order,
    title: str,
    verb: str,
    type_: NotificationType = NotificationType.ORDER,
) -> None:
    seller = db.get(SellerProfile, order.seller_profile_id)
    if seller:
        push(
            db, seller.user_id, type_,
            title,
            f"Order #{short_id(order.id)} {verb}",
            link_url=f"/seller/orders/{order.id}",
        )


# ── buyer orders (the buyer dashboard) ────────────────────────────────────────

def _store_of(db: Session, order: Order) -> SellerProfile | None:
    return db.get(SellerProfile, order.seller_profile_id)


def _summary(order: Order) -> str:
    first = order.items[0] if order.items else None
    if first is None:
        return "—"
    text = f"{first.name_at_purchase or 'Product'} ×{first.quantity}"
    if len(order.items) > 1:
        text += f" + {len(order.items) - 1} more"
    return text


@buyer.get("/orders", response_model=BuyerOrderList)
def buyer_orders(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.BUYER)),
) -> BuyerOrderList:
    """Every order this account has placed, across all storefronts."""
    orders = db.scalars(
        select(Order)
        .where(Order.buyer_user_id == user.id)
        .options(*_LOADERS)
        .order_by(Order.created_at.desc())
    ).all()

    items: list[BuyerOrderListItem] = []
    for o in orders:
        store = _store_of(db, o)
        thumb = _item_out(db, o.items[0]) if o.items else None
        items.append(
            BuyerOrderListItem(
                id=o.id,
                short_id=short_id(o.id),
                store_name=store.store_name if store else None,
                store_slug=store.slug if store else None,
                product_summary=_summary(o),
                thumbnail_url=(thumb.design_url or thumb.base_image_url) if thumb else None,
                item_count=sum(i.quantity for i in o.items),
                total=o.total_amount,
                created_at=o.created_at,
                status=display_status(o),
                tracking_number=o.tracking_number,
            )
        )
    return BuyerOrderList(items=items)


@buyer.get("/orders/{order_id}", response_model=BuyerOrderDetail)
def buyer_order(
    order_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.BUYER)),
) -> BuyerOrderDetail:
    order = db.scalar(
        select(Order).where(Order.id == order_id).options(*_LOADERS)
    )
    # 404 (not 403) when it isn't the buyer's own order — don't leak existence.
    if order is None or order.buyer_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
    store = _store_of(db, order)
    return BuyerOrderDetail(
        id=order.id,
        short_id=short_id(order.id),
        status=display_status(order),
        created_at=order.created_at,
        store_name=store.store_name if store else None,
        store_slug=store.slug if store else None,
        subtotal=order.subtotal,
        discount_amount=order.discount_amount,
        discount_code=order.discount_code,
        shipping_amount=order.shipping_amount,
        tax_amount=order.tax_amount,
        total=order.total_amount,
        ship_name=order.ship_name,
        ship_address=order.ship_address,
        ship_city=order.ship_city,
        ship_postal=order.ship_postal,
        ship_country=order.ship_country,
        tracking_number=order.tracking_number,
        items=[_item_out(db, i) for i in order.items],
        events=[EventOut(type=e.type.value, note=e.note, created_at=e.created_at) for e in order.events],
    )


routers = [public, router, production, buyer]
