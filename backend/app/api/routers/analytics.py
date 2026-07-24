"""Seller analytics: one endpoint, one date range, the whole dashboard payload.

Revenue counts orders whose money is real (PAID — fulfillment progress doesn't
change revenue; CANCELLED/REFUNDED are excluded). Visitors come from the
StoreVisit counter on the public page; conversion = orders ÷ unique visitors.
Everything is computed per-request over the seller's own rows — no denormalised
stats tables to drift out of sync at MVP volumes.
"""

import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import require_role
from app.core.database import get_db
from app.models.catalog import BaseItem, ItemCategory
from app.models.commerce import Order, OrderItem, StoreVisit
from app.models.enums import OrderStatus, Role
from app.models.shop import ShopItem
from app.models.user import SellerProfile, User

router = APIRouter(prefix="/seller/analytics", tags=["analytics"])


class DayPoint(BaseModel):
    day: date
    revenue: Decimal
    orders: int
    visitors: int


class CountryRow(BaseModel):
    country: str
    revenue: Decimal
    orders: int


class ProductRow(BaseModel):
    shop_item_id: uuid.UUID | None
    name: str
    revenue: Decimal
    units: int
    # Orders containing this product ÷ store visitors (store-level denominator —
    # per-product page views aren't tracked yet).
    conversion: float | None
    # ⏭️ lights up when buyer reviews ship.
    rating: float | None = None


class CategoryRow(BaseModel):
    category: str
    revenue: Decimal
    units: int


class AnalyticsOut(BaseModel):
    date_from: date
    date_to: date
    revenue: Decimal
    orders: int
    visitors: int
    conversion: float | None  # %
    avg_order_value: Decimal | None
    by_day: list[DayPoint]
    by_country: list[CountryRow]
    top_products: list[ProductRow]
    top_categories: list[CategoryRow]


def _profile(db: Session, user: User) -> SellerProfile:
    p = db.scalar(select(SellerProfile).where(SellerProfile.user_id == user.id))
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No seller profile.")
    return p


@router.get("", response_model=AnalyticsOut)
def get_analytics(
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> AnalyticsOut:
    profile = _profile(db, user)
    today = datetime.now(timezone.utc).date()
    start = date_from or (today - timedelta(days=29))
    end = date_to or today
    if start > end:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Backwards date range.")
    start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(end, time.max, tzinfo=timezone.utc)

    orders = db.scalars(
        select(Order)
        .where(
            Order.seller_profile_id == profile.id,
            Order.status == OrderStatus.PAID,
            Order.created_at >= start_dt,
            Order.created_at <= end_dt,
        )
        .options(selectinload(Order.items))
    ).all()

    visit_rows = db.execute(
        select(StoreVisit.day, func.count())
        .where(StoreVisit.seller_profile_id == profile.id, StoreVisit.day >= start, StoreVisit.day <= end)
        .group_by(StoreVisit.day)
    ).all()
    visits_by_day = {d: n for d, n in visit_rows}
    visitors = sum(visits_by_day.values())

    revenue = sum((Decimal(o.subtotal) for o in orders), Decimal("0")).quantize(Decimal("0.01"))
    n_orders = len(orders)

    # ── per-day series (zero-filled so charts don't skip quiet days) ─────────
    by_day: list[DayPoint] = []
    orders_by_day: dict[date, list[Order]] = {}
    for o in orders:
        orders_by_day.setdefault(o.created_at.date(), []).append(o)
    d = start
    while d <= end:
        day_orders = orders_by_day.get(d, [])
        by_day.append(
            DayPoint(
                day=d,
                revenue=sum((Decimal(o.subtotal) for o in day_orders), Decimal("0")),
                orders=len(day_orders),
                visitors=visits_by_day.get(d, 0),
            )
        )
        d += timedelta(days=1)

    # ── country breakdown ────────────────────────────────────────────────────
    by_country: dict[str, CountryRow] = {}
    for o in orders:
        key = (o.ship_country or "Unknown").strip().title() or "Unknown"
        row = by_country.setdefault(key, CountryRow(country=key, revenue=Decimal("0"), orders=0))
        row.revenue += Decimal(o.subtotal)
        row.orders += 1

    # ── products + categories ────────────────────────────────────────────────
    prod: dict[str, ProductRow] = {}
    prod_orders: dict[str, set[uuid.UUID]] = {}
    cats: dict[str, CategoryRow] = {}
    category_names: dict[uuid.UUID, str] = {}
    for o in orders:
        for it in o.items:
            key = str(it.shop_item_id)
            line = Decimal(it.unit_price_at_purchase) * it.quantity
            row = prod.setdefault(
                key,
                ProductRow(
                    shop_item_id=it.shop_item_id,
                    name=it.name_at_purchase or "Product",
                    revenue=Decimal("0"),
                    units=0,
                    conversion=None,
                ),
            )
            row.revenue += line
            row.units += it.quantity
            prod_orders.setdefault(key, set()).add(o.id)

            shop_item = db.get(ShopItem, it.shop_item_id)
            base = db.get(BaseItem, shop_item.base_item_id) if shop_item else None
            if base and base.category_id:
                if base.category_id not in category_names:
                    cat = db.get(ItemCategory, base.category_id)
                    category_names[base.category_id] = cat.name if cat else "Other"
                cname = category_names[base.category_id]
            else:
                cname = "Other"
            crow = cats.setdefault(cname, CategoryRow(category=cname, revenue=Decimal("0"), units=0))
            crow.revenue += line
            crow.units += it.quantity

    for key, row in prod.items():
        if visitors > 0:
            row.conversion = round(len(prod_orders[key]) / visitors * 100, 2)

    return AnalyticsOut(
        date_from=start,
        date_to=end,
        revenue=revenue,
        orders=n_orders,
        visitors=visitors,
        conversion=round(n_orders / visitors * 100, 2) if visitors > 0 else None,
        avg_order_value=(revenue / n_orders).quantize(Decimal("0.01")) if n_orders else None,
        by_day=by_day,
        by_country=sorted(by_country.values(), key=lambda r: r.revenue, reverse=True),
        top_products=sorted(prod.values(), key=lambda r: r.revenue, reverse=True)[:10],
        top_categories=sorted(cats.values(), key=lambda r: r.revenue, reverse=True),
    )
