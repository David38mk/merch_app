"""The buyer-facing marketplace: a discovery homepage aggregating products and
brands across every live storefront, plus a category/search listing.

There's no Admin Panel yet to hand-pick featured content, so every section is
**derived from real signals** — sales for "featured"/"trending", recency for
"new arrivals" — with a newest-first fallback so a fresh platform (no sales yet)
never shows an empty shelf. When admin curation lands, these become the defaults
an admin can override.
"""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import distinct, func, or_, select
from sqlalchemy.orm import Session, selectinload

import uuid
from datetime import datetime
from decimal import Decimal

from app.api.routers.orders import display_status
from app.api.routers.reviews import product_rating
from app.core.database import get_db
from app.core.discounts import resolve_discount
from app.core.pricing import SHIPPING_METHODS, order_totals, shipping_for
from app.core.security import decode_token
from app.core.slug import normalize_slug
from app.models.catalog import BaseItem, BaseItemVariant, ItemCategory, PrintOption
from app.models.commerce import Order, OrderItem, StoreVisit
from app.models.design import Design
from app.models.enums import OrderStatus, PrintOptionKind, ShopItemState, StoreState
from app.models.shop import ShopItem
from app.models.user import SellerProfile, User

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

_TRENDING_WINDOW = timedelta(days=30)


# ── schemas ──────────────────────────────────────────────────────────────────

class ProductCard(BaseModel):
    id: str
    name: str
    price: str
    category: str | None
    base_image_url: str | None
    design_url: str | None
    pos_x: float
    pos_y: float
    scale: float
    rotation: float
    store_name: str
    store_slug: str


class BrandCard(BaseModel):
    slug: str
    name: str
    logo_url: str | None
    cover_url: str | None
    product_count: int
    sample_images: list[str]  # up to 3 product thumbnails


class CategoryTile(BaseModel):
    name: str
    slug: str
    count: int
    image_url: str | None


class Hero(BaseModel):
    headline: str
    subtext: str
    cta_label: str
    cta_href: str
    brand: BrandCard | None
    product: ProductCard | None


class HomeOut(BaseModel):
    hero: Hero
    featured_products: list[ProductCard]
    trending_brands: list[BrandCard]
    categories: list[CategoryTile]
    new_arrivals: list[ProductCard]


class ProductList(BaseModel):
    items: list[ProductCard]
    total: int


# ── helpers ──────────────────────────────────────────────────────────────────

def _live_store_ids(db: Session) -> list:
    return db.scalars(
        select(SellerProfile.id).where(SellerProfile.store_state == StoreState.LIVE)
    ).all()


def _card(it: ShopItem, design_url: str | None) -> ProductCard:
    base = it.base_item
    return ProductCard(
        id=str(it.id),
        name=it.name,
        price=str(it.price),
        category=base.category.name if base and base.category else None,
        base_image_url=base.image_url if base else None,
        design_url=design_url,
        pos_x=it.pos_x,
        pos_y=it.pos_y,
        scale=it.scale,
        rotation=it.rotation,
        store_name=it.seller.store_name or "Untitled store",
        store_slug=it.seller.slug or "",
    )


_CARD_LOADERS = (
    selectinload(ShopItem.base_item).selectinload(BaseItem.category),
    selectinload(ShopItem.seller),
)


def _cards(db: Session, items: list[ShopItem]) -> list[ProductCard]:
    # One query for all the designs instead of one per card.
    design_ids = {it.design_id for it in items if it.design_id}
    designs = {}
    if design_ids:
        designs = {d.id: d.resource_url for d in db.scalars(select(Design).where(Design.id.in_(design_ids))).all()}
    return [_card(it, designs.get(it.design_id)) for it in items]


def _sales_by_item(db: Session) -> dict:
    rows = db.execute(
        select(OrderItem.shop_item_id, func.count())
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.status == OrderStatus.PAID)
        .group_by(OrderItem.shop_item_id)
    ).all()
    return {sid: n for sid, n in rows}


def _brand_card(db: Session, p: SellerProfile) -> BrandCard | None:
    items = db.scalars(
        select(ShopItem)
        .where(ShopItem.seller_profile_id == p.id, ShopItem.state == ShopItemState.LISTED)
        .order_by(ShopItem.created_at.desc())
        .options(*_CARD_LOADERS)
    ).all()
    if not items:
        return None  # an empty store isn't a brand to feature
    samples = []
    for it in items[:3]:
        design = db.get(Design, it.design_id) if it.design_id else None
        samples.append((design.resource_url if design else None) or (it.base_item.image_url if it.base_item else None))
    return BrandCard(
        slug=p.slug or "",
        name=p.store_name or "Untitled store",
        logo_url=p.avatar_url,
        cover_url=p.cover_url,
        product_count=len(items),
        sample_images=[s for s in samples if s],
    )


# ── homepage aggregate ───────────────────────────────────────────────────────

@router.get("/home", response_model=HomeOut)
def home(db: Session = Depends(get_db)) -> HomeOut:
    live_ids = _live_store_ids(db)
    if not live_ids:
        return HomeOut(
            hero=Hero(
                headline="Merch from independent creators",
                subtext="Discover original designs printed on demand.",
                cta_label="Explore the marketplace",
                cta_href="/marketplace",
                brand=None,
                product=None,
            ),
            featured_products=[], trending_brands=[], categories=[], new_arrivals=[],
        )

    sales = _sales_by_item(db)

    listed = db.scalars(
        select(ShopItem)
        .where(ShopItem.seller_profile_id.in_(live_ids), ShopItem.state == ShopItemState.LISTED)
        .options(*_CARD_LOADERS)
    ).all()

    # Featured = best-selling; ties and the no-sales-yet case fall back to newest.
    by_popularity = sorted(listed, key=lambda it: (-sales.get(it.id, 0), -it.created_at.timestamp()))
    featured = _cards(db, by_popularity[:8])

    # New arrivals = most recently listed.
    by_recency = sorted(listed, key=lambda it: it.created_at, reverse=True)
    new_arrivals = _cards(db, by_recency[:8])

    # Trending brands: most sales in the last 30 days, then recent visits, then
    # newest live store — every store with products is eligible.
    since = datetime.now(timezone.utc) - _TRENDING_WINDOW
    recent_sales = dict(db.execute(
        select(Order.seller_profile_id, func.count())
        .where(Order.status == OrderStatus.PAID, Order.created_at >= since)
        .group_by(Order.seller_profile_id)
    ).all())
    recent_visits = dict(db.execute(
        select(StoreVisit.seller_profile_id, func.count())
        .where(StoreVisit.day >= since.date())
        .group_by(StoreVisit.seller_profile_id)
    ).all())
    stores = db.scalars(
        select(SellerProfile)
        .where(SellerProfile.id.in_(live_ids))
        .order_by(SellerProfile.last_published_at.desc().nullslast(), SellerProfile.created_at.desc())
    ).all()
    stores.sort(key=lambda p: (-recent_sales.get(p.id, 0), -recent_visits.get(p.id, 0)))
    trending = [c for c in (_brand_card(db, p) for p in stores) if c is not None][:6]

    # Categories with at least one live product.
    cat_rows = db.execute(
        select(ItemCategory.name, func.count(ShopItem.id))
        .join(BaseItem, BaseItem.category_id == ItemCategory.id)
        .join(ShopItem, ShopItem.base_item_id == BaseItem.id)
        .where(ShopItem.seller_profile_id.in_(live_ids), ShopItem.state == ShopItemState.LISTED)
        .group_by(ItemCategory.name)
        .order_by(func.count(ShopItem.id).desc())
    ).all()
    categories = [
        CategoryTile(
            name=name, slug=normalize_slug(name), count=n,
            image_url=_category_image(db, live_ids, name),
        )
        for name, n in cat_rows
    ]

    top_brand = trending[0] if trending else None
    hero_product = featured[0] if featured else None
    return HomeOut(
        hero=Hero(
            headline="Wear what you love, from creators you love",
            subtext="Original merch from independent creators — designed by them, printed on demand.",
            cta_label="Start exploring",
            cta_href="/marketplace",
            brand=top_brand,
            product=hero_product,
        ),
        featured_products=featured,
        trending_brands=trending,
        categories=categories,
        new_arrivals=new_arrivals,
    )


def _category_image(db: Session, live_ids: list, category_name: str) -> str | None:
    it = db.scalar(
        select(ShopItem)
        .join(BaseItem, BaseItem.id == ShopItem.base_item_id)
        .join(ItemCategory, ItemCategory.id == BaseItem.category_id)
        .where(
            ShopItem.seller_profile_id.in_(live_ids),
            ShopItem.state == ShopItemState.LISTED,
            ItemCategory.name == category_name,
        )
        .order_by(ShopItem.created_at.desc())
        .options(selectinload(ShopItem.base_item))
    )
    if it is None:
        return None
    design = db.get(Design, it.design_id) if it.design_id else None
    return (design.resource_url if design else None) or (it.base_item.image_url if it.base_item else None)


# ── facets (filter options over the live catalogue) ──────────────────────────

class BrandFacet(BaseModel):
    slug: str
    name: str
    count: int


class Facets(BaseModel):
    categories: list[CategoryTile]
    brands: list[BrandFacet]
    colors: list[str]
    sizes: list[str]
    price_min: float
    price_max: float


@router.get("/facets", response_model=Facets)
def facets(db: Session = Depends(get_db)) -> Facets:
    """Every filter option the marketplace offers, over live + listed products.
    Static (not recomputed per selection) — dynamic faceted counts are a future
    nicety; this keeps the call cheap."""
    live_ids = _live_store_ids(db)
    if not live_ids:
        return Facets(categories=[], brands=[], colors=[], sizes=[], price_min=0, price_max=0)

    listed = (ShopItem.seller_profile_id.in_(live_ids), ShopItem.state == ShopItemState.LISTED)

    cat_rows = db.execute(
        select(ItemCategory.name, func.count(ShopItem.id))
        .join(BaseItem, BaseItem.category_id == ItemCategory.id)
        .join(ShopItem, ShopItem.base_item_id == BaseItem.id)
        .where(*listed)
        .group_by(ItemCategory.name)
        .order_by(func.count(ShopItem.id).desc())
    ).all()
    categories = [
        CategoryTile(name=n, slug=normalize_slug(n), count=c, image_url=None) for n, c in cat_rows
    ]

    brand_rows = db.execute(
        select(SellerProfile.slug, SellerProfile.store_name, func.count(ShopItem.id))
        .join(ShopItem, ShopItem.seller_profile_id == SellerProfile.id)
        .where(*listed)
        .group_by(SellerProfile.slug, SellerProfile.store_name)
        .order_by(func.count(ShopItem.id).desc())
    ).all()
    brands = [
        BrandFacet(slug=slug or "", name=name or "Untitled store", count=c)
        for slug, name, c in brand_rows if slug
    ]

    # Colours/sizes buyable across the live catalogue — from the blanks' available
    # variants (what a buyer can actually order), not the seller's primary pick.
    base_ids = select(distinct(ShopItem.base_item_id)).where(*listed)
    colors = list(db.scalars(
        select(distinct(BaseItemVariant.color))
        .where(BaseItemVariant.is_available.is_(True), BaseItemVariant.base_item_id.in_(base_ids))
        .order_by(BaseItemVariant.color)
    ).all())
    sizes = list(db.scalars(
        select(distinct(BaseItemVariant.size))
        .where(BaseItemVariant.is_available.is_(True), BaseItemVariant.base_item_id.in_(base_ids))
    ).all())

    lo, hi = db.execute(select(func.min(ShopItem.price), func.max(ShopItem.price)).where(*listed)).one()
    return Facets(
        categories=categories, brands=brands, colors=colors, sizes=_order_sizes(sizes),
        price_min=float(lo or 0), price_max=float(hi or 0),
    )


_SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL", "One Size"]


def _order_sizes(sizes: list[str]) -> list[str]:
    def key(s: str) -> tuple[int, str]:
        return (_SIZE_ORDER.index(s), "") if s in _SIZE_ORDER else (len(_SIZE_ORDER), s)
    return sorted(sizes, key=key)


# ── product detail (the Product Details Page) ────────────────────────────────

class BrandRef(BaseModel):
    slug: str
    name: str
    logo_url: str | None


class VariantOut(BaseModel):
    color: str
    size: str
    available: bool


class ProductDetail(BaseModel):
    id: str
    name: str
    price: str
    description: str | None
    category: str | None
    brand: BrandRef
    base_image_url: str | None
    design_url: str | None
    pos_x: float
    pos_y: float
    scale: float
    rotation: float
    colors: list[str]
    sizes: list[str]
    variants: list[VariantOut]  # every combo + whether it's in stock
    materials: list[str]
    print_methods: list[str]
    production_time: str | None
    rating_average: float | None
    rating_count: int
    related: list[ProductCard]


@router.get("/products/{product_id}", response_model=ProductDetail)
def product_detail(product_id: str, db: Session = Depends(get_db)) -> ProductDetail:
    item = db.scalar(
        select(ShopItem)
        .where(ShopItem.id == product_id)
        .options(
            selectinload(ShopItem.base_item).selectinload(BaseItem.variants),
            selectinload(ShopItem.base_item).selectinload(BaseItem.category),
            selectinload(ShopItem.base_item).selectinload(BaseItem.print_options),
            selectinload(ShopItem.seller),
        )
    )
    seller = item.seller if item else None
    # Only a LISTED product on a LIVE storefront is publicly viewable.
    if item is None or item.state != ShopItemState.LISTED or seller is None or seller.store_state != StoreState.LIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    base = item.base_item
    variants = base.variants if base else []
    avail = [v for v in variants if v.is_available]
    colors: list[str] = []
    for v in avail:  # preserve first-seen order, dedup
        if v.color not in colors:
            colors.append(v.color)
    sizes = _order_sizes(list({v.size for v in avail}))
    materials = [o.name for o in (base.print_options if base else []) if o.kind == PrintOptionKind.MATERIAL]
    methods = [o.name for o in (base.print_options if base else []) if o.kind == PrintOptionKind.PRINT_TYPE]
    design = db.get(Design, item.design_id) if item.design_id else None
    _rating = product_rating(db, item.id)

    return ProductDetail(
        id=str(item.id),
        name=item.name,
        price=str(item.price),
        description=item.description,
        category=base.category.name if base and base.category else None,
        brand=BrandRef(slug=seller.slug or "", name=seller.store_name or "Untitled store", logo_url=seller.avatar_url),
        base_image_url=base.image_url if base else None,
        design_url=design.resource_url if design else None,
        pos_x=item.pos_x, pos_y=item.pos_y, scale=item.scale, rotation=item.rotation,
        colors=colors,
        sizes=sizes,
        variants=[VariantOut(color=v.color, size=v.size, available=v.is_available) for v in variants],
        materials=materials or ([item.material] if item.material else []),
        print_methods=methods or ([item.print_type] if item.print_type else []),
        production_time=base.production_time if base else None,
        rating_average=_rating[0],
        rating_count=_rating[1],
        related=_related(db, item, base),
    )


class DiscountValidateIn(BaseModel):
    code: str
    slug: str      # the brand the cart is for (scoped codes)
    subtotal: Decimal


class DiscountValidateOut(BaseModel):
    valid: bool
    amount: Decimal = Decimal("0.00")   # € off, for this subtotal
    kind: str | None = None
    message: str | None = None
    # The full recomputed money breakdown, so the cart shows exact totals.
    discount: Decimal = Decimal("0.00")
    shipping: Decimal = Decimal("0.00")
    tax: Decimal = Decimal("0.00")
    total: Decimal = Decimal("0.00")


@router.post("/discount/validate", response_model=DiscountValidateOut)
def validate_discount(payload: DiscountValidateIn, db: Session = Depends(get_db)) -> DiscountValidateOut:
    seller = db.scalar(select(SellerProfile).where(SellerProfile.slug == payload.slug))
    if seller is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storefront not found.")
    row, amount, error = resolve_discount(db, payload.code, seller.id, payload.subtotal)
    totals = order_totals(payload.subtotal, amount)
    if error:
        # Still return the no-discount totals so the summary can render.
        base = order_totals(payload.subtotal, Decimal("0.00"))
        return DiscountValidateOut(valid=False, message=error, **base)
    return DiscountValidateOut(
        valid=True, amount=amount, kind=row.kind.value if row else None,
        discount=totals["discount"], shipping=totals["shipping"], tax=totals["tax"], total=totals["total"],
    )


# ── shipping methods + order confirmation (checkout) ──────────────────────────

class ShippingMethodOut(BaseModel):
    id: str
    label: str
    estimate: str
    cost: Decimal
    free: bool


@router.get("/shipping-methods", response_model=list[ShippingMethodOut])
def shipping_methods(subtotal: Decimal = Query(default=Decimal("0"))) -> list[ShippingMethodOut]:
    """The shipping options + their cost for a given cart subtotal (so free
    thresholds are reflected in the price shown)."""
    out = []
    for mid, spec in SHIPPING_METHODS.items():
        cost = shipping_for(subtotal, mid)
        out.append(ShippingMethodOut(id=mid, label=spec["label"], estimate=spec["estimate"], cost=cost, free=cost == 0))
    return out


class ConfItem(BaseModel):
    name: str
    color: str | None
    size: str | None
    quantity: int
    unit_price: Decimal
    base_image_url: str | None
    design_url: str | None
    pos_x: float
    pos_y: float
    scale: float
    rotation: float


class OrderConfirmation(BaseModel):
    short_id: str
    created_at: datetime
    status: str  # derived display status — drives the "Next steps" tracker
    email: str | None
    store_name: str | None
    store_slug: str | None
    payment_method: str | None
    items: list[ConfItem]
    ship_name: str | None
    ship_phone: str | None
    ship_address: str | None
    ship_city: str | None
    ship_postal: str | None
    ship_country: str | None
    shipping_method: str | None
    shipping_estimate: str | None
    est_delivery_from: date | None
    est_delivery_to: date | None
    subtotal: Decimal
    discount_amount: Decimal
    discount_code: str | None
    shipping_amount: Decimal
    tax_amount: Decimal
    total: Decimal


@router.get("/order-confirmation", response_model=OrderConfirmation)
def order_confirmation(token: str, db: Session = Depends(get_db)) -> OrderConfirmation:
    """Guest-safe order confirmation, addressed only by a signed token from
    checkout — no order is reachable by guessing an id."""
    subject = decode_token(token, "confirm")
    if subject is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired confirmation link.")
    order = db.scalar(
        select(Order).where(Order.id == uuid.UUID(subject)).options(selectinload(Order.items))
    )
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

    store = db.get(SellerProfile, order.seller_profile_id)
    buyer = db.get(User, order.buyer_user_id)
    method_spec = SHIPPING_METHODS.get(order.shipping_method or "") if order.shipping_method else None
    if order.card_last4:
        payment_method = f"{order.card_brand} •• {order.card_last4}" if order.card_brand else f"Card •• {order.card_last4}"
    else:
        payment_method = "Card"

    items = []
    for it in order.items:
        shop = db.get(ShopItem, it.shop_item_id)
        variant = db.get(BaseItemVariant, it.base_item_variant_id)
        base = db.get(BaseItem, shop.base_item_id) if shop else None
        design = db.get(Design, shop.design_id) if shop and shop.design_id else None
        items.append(ConfItem(
            name=it.name_at_purchase or (shop.name if shop else "Product"),
            color=variant.color if variant else None,
            size=variant.size if variant else None,
            quantity=it.quantity,
            unit_price=it.unit_price_at_purchase,
            base_image_url=base.image_url if base else None,
            design_url=design.resource_url if design else None,
            pos_x=it.pos_x if it.pos_x is not None else 50,
            pos_y=it.pos_y if it.pos_y is not None else 45,
            scale=it.scale if it.scale is not None else 0.45,
            rotation=it.rotation if it.rotation is not None else 0,
        ))

    return OrderConfirmation(
        short_id=order.id.hex[:8].upper(),
        created_at=order.created_at,
        status=display_status(order),
        email=buyer.email if buyer else None,
        store_name=store.store_name if store else None,
        store_slug=store.slug if store else None,
        payment_method=payment_method,
        items=items,
        ship_name=order.ship_name,
        ship_phone=order.ship_phone,
        ship_address=order.ship_address,
        ship_city=order.ship_city,
        ship_postal=order.ship_postal,
        ship_country=order.ship_country,
        shipping_method=method_spec["label"] if method_spec else (order.shipping_method or None),
        shipping_estimate=method_spec["estimate"] if method_spec else None,
        est_delivery_from=order.est_delivery_from,
        est_delivery_to=order.est_delivery_to,
        subtotal=order.subtotal,
        discount_amount=order.discount_amount,
        discount_code=order.discount_code,
        shipping_amount=order.shipping_amount,
        tax_amount=order.tax_amount,
        total=order.total_amount,
    )


# ── wishlist cards (saved products, with live availability) ───────────────────

class WishlistCard(BaseModel):
    shop_item_id: str
    name: str
    price: str
    category: str | None
    brand_slug: str
    brand_name: str
    base_image_url: str | None
    design_url: str | None
    pos_x: float
    pos_y: float
    scale: float
    rotation: float
    available: bool                    # LISTED + store LIVE + a buyable variant
    sole_variant: VariantOut | None    # set only when exactly one buyable variant


class WishlistCardsIn(BaseModel):
    ids: list[str]


@router.post("/wishlist-cards", response_model=list[WishlistCard])
def wishlist_cards(payload: WishlistCardsIn, db: Session = Depends(get_db)) -> list[WishlistCard]:
    """Render saved products (by id) with live availability. Public — guests and
    logged-in buyers share this card-builder. Input order is preserved; ids that
    no longer resolve to a product (hard-deleted) are dropped. Unlisted / offline
    products are kept but marked unavailable (a wishlist is 'save for later')."""
    out: list[WishlistCard] = []
    for raw in payload.ids:
        try:
            sid = uuid.UUID(raw)
        except (ValueError, AttributeError):
            continue
        item = db.scalar(
            select(ShopItem)
            .where(ShopItem.id == sid)
            .options(
                selectinload(ShopItem.base_item).selectinload(BaseItem.variants),
                selectinload(ShopItem.base_item).selectinload(BaseItem.category),
                selectinload(ShopItem.seller),
            )
        )
        if item is None:
            continue
        seller = item.seller
        base = item.base_item
        buyable = [v for v in (base.variants if base else []) if v.is_available]
        live = item.state == ShopItemState.LISTED and seller is not None and seller.store_state == StoreState.LIVE
        available = bool(live and buyable)
        sole = (
            VariantOut(color=buyable[0].color, size=buyable[0].size, available=True)
            if available and len(buyable) == 1
            else None
        )
        design = db.get(Design, item.design_id) if item.design_id else None
        out.append(
            WishlistCard(
                shop_item_id=str(item.id),
                name=item.name,
                price=str(item.price),
                category=base.category.name if base and base.category else None,
                brand_slug=seller.slug or "" if seller else "",
                brand_name=(seller.store_name or "Untitled store") if seller else "Unknown",
                base_image_url=base.image_url if base else None,
                design_url=design.resource_url if design else None,
                pos_x=item.pos_x,
                pos_y=item.pos_y,
                scale=item.scale,
                rotation=item.rotation,
                available=available,
                sole_variant=sole,
            )
        )
    return out


def _related(db: Session, item: ShopItem, base: BaseItem | None) -> list[ProductCard]:
    """Other products from the same brand, then similar products (same category)
    from other live stores. Deduped, self excluded, capped."""
    live_ids = _live_store_ids(db)
    picks: list[ShopItem] = []
    seen = {item.id}

    same_brand = db.scalars(
        select(ShopItem)
        .where(
            ShopItem.seller_profile_id == item.seller_profile_id,
            ShopItem.state == ShopItemState.LISTED,
            ShopItem.id != item.id,
        )
        .order_by(ShopItem.created_at.desc())
        .options(*_CARD_LOADERS)
    ).all()
    for p in same_brand:
        if p.id not in seen:
            seen.add(p.id)
            picks.append(p)

    if base and base.category_id:
        similar = db.scalars(
            select(ShopItem)
            .join(BaseItem, BaseItem.id == ShopItem.base_item_id)
            .where(
                BaseItem.category_id == base.category_id,
                ShopItem.state == ShopItemState.LISTED,
                ShopItem.seller_profile_id.in_(live_ids),
                ShopItem.seller_profile_id != item.seller_profile_id,
            )
            .order_by(ShopItem.created_at.desc())
            .options(*_CARD_LOADERS)
        ).all()
        for p in similar:
            if p.id not in seen:
                seen.add(p.id)
                picks.append(p)

    return _cards(db, picks[:8])


# ── category / search listing ────────────────────────────────────────────────

@router.get("/products", response_model=ProductList)
def products(
    category: str | None = None,
    q: str | None = None,
    brand: list[str] | None = Query(default=None),  # seller slugs
    color: list[str] | None = Query(default=None),
    size: list[str] | None = Query(default=None),
    price_min: float | None = None,
    price_max: float | None = None,
    sort: str = "popular",
    limit: int = Query(default=24, ge=1, le=60),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> ProductList:
    live_ids = _live_store_ids(db)
    if not live_ids:
        return ProductList(items=[], total=0)

    stmt = (
        select(ShopItem)
        .join(BaseItem, BaseItem.id == ShopItem.base_item_id)
        .join(SellerProfile, SellerProfile.id == ShopItem.seller_profile_id)
        .where(ShopItem.seller_profile_id.in_(live_ids), ShopItem.state == ShopItemState.LISTED)
        .options(*_CARD_LOADERS)
    )
    if category:
        stmt = stmt.join(ItemCategory, ItemCategory.id == BaseItem.category_id).where(
            ItemCategory.name.ilike(category.strip())
        )
    if q:
        # Search product name, brand name and the seller's keywords (tags).
        needle = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(ShopItem.name.ilike(needle), SellerProfile.store_name.ilike(needle), ShopItem.tags.ilike(needle))
        )
    if brand:
        stmt = stmt.where(SellerProfile.slug.in_(brand))
    if price_min is not None:
        stmt = stmt.where(ShopItem.price >= price_min)
    if price_max is not None:
        stmt = stmt.where(ShopItem.price <= price_max)
    # Colour/size match the blank's buyable variants (a product offered in red
    # surfaces under "Red" even if the seller's primary pick was blue).
    if color:
        stmt = stmt.where(ShopItem.base_item_id.in_(
            select(BaseItemVariant.base_item_id).where(
                BaseItemVariant.is_available.is_(True), BaseItemVariant.color.in_(color)
            )
        ))
    if size:
        stmt = stmt.where(ShopItem.base_item_id.in_(
            select(BaseItemVariant.base_item_id).where(
                BaseItemVariant.is_available.is_(True), BaseItemVariant.size.in_(size)
            )
        ))

    rows = db.scalars(stmt).all()
    total = len(rows)

    if sort == "popular":
        sales = _sales_by_item(db)
        rows.sort(key=lambda it: (-sales.get(it.id, 0), -it.created_at.timestamp()))
    elif sort == "price_asc":
        rows.sort(key=lambda it: it.price)
    elif sort == "price_desc":
        rows.sort(key=lambda it: it.price, reverse=True)
    else:  # newest
        rows.sort(key=lambda it: it.created_at, reverse=True)

    page = rows[offset : offset + limit]
    return ProductList(items=_cards(db, page), total=total)
