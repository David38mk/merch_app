import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import DiscountKind, FulfillmentStatus, OrderEventType, OrderStatus, ReviewStatus


class Cart(UUIDMixin, TimestampMixin, Base):
    """A Buyer's in-progress basket from a single Seller."""

    __tablename__ = "carts"

    buyer_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    seller_profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("seller_profiles.id"))

    items: Mapped[list["CartItem"]] = relationship(back_populates="cart", cascade="all, delete-orphan")


class CartItem(UUIDMixin, Base):
    __tablename__ = "cart_items"

    cart_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("carts.id", ondelete="CASCADE"))
    shop_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shop_items.id"))
    base_item_variant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("base_item_variants.id"))
    quantity: Mapped[int] = mapped_column(Integer, default=1)

    cart: Mapped["Cart"] = relationship(back_populates="items")


class Order(UUIDMixin, TimestampMixin, Base):
    """A paid purchase. Commission is snapshotted at order time."""

    __tablename__ = "orders"

    buyer_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    seller_profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("seller_profiles.id"))
    status: Mapped[OrderStatus] = mapped_column(SAEnum(OrderStatus), default=OrderStatus.PENDING)

    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)  # product revenue (drives commission/payout)
    commission_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=0)  # snapshot of plan rate
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    seller_payout_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)

    # ── buyer-facing money model (platform-absorbed; seller payout is unaffected) ──
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, server_default="0")
    discount_code: Mapped[str | None] = mapped_column(String, nullable=True)
    shipping_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, server_default="0")
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, server_default="0")
    # What the buyer paid = subtotal − discount + shipping + tax.
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, server_default="0")

    stripe_payment_intent_id: Mapped[str | None] = mapped_column(nullable=True)  # ⏭️🔌 gateway
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Client-generated per checkout attempt — a repeat submit (double-click,
    # retry, back-button) returns the same order instead of creating a duplicate.
    idempotency_key: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    shipping_method: Mapped[str | None] = mapped_column(String, nullable=True)  # "standard" | "express"
    # Non-sensitive card display only (PCI-safe): brand + last 4. The PAN/CVV/
    # expiry never reach the server — a real gateway tokenises those.
    card_brand: Mapped[str | None] = mapped_column(String, nullable=True)
    card_last4: Mapped[str | None] = mapped_column(String, nullable=True)
    # Estimated delivery window, snapshotted at order time from the shipping method.
    est_delivery_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    est_delivery_to: Mapped[date | None] = mapped_column(Date, nullable=True)

    # ── shipping (entered at checkout; tracking added by the print shop) ─────
    ship_name: Mapped[str | None] = mapped_column(String, nullable=True)
    ship_phone: Mapped[str | None] = mapped_column(String, nullable=True)
    ship_address: Mapped[str | None] = mapped_column(String, nullable=True)
    ship_city: Mapped[str | None] = mapped_column(String, nullable=True)
    ship_postal: Mapped[str | None] = mapped_column(String, nullable=True)
    ship_country: Mapped[str | None] = mapped_column(String, nullable=True)
    shipping_carrier: Mapped[str | None] = mapped_column(String, nullable=True)  # carrier id (see core.carriers)
    tracking_number: Mapped[str | None] = mapped_column(String, nullable=True)  # 🔌 cargo seam
    shipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    seller: Mapped["SellerProfile"] = relationship(back_populates="orders")  # noqa: F821
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    events: Mapped[list["OrderEvent"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderEvent.created_at"
    )


class OrderItem(UUIDMixin, Base):
    """A purchased line. Also the PrintShop production-queue row (fulfillment_status)."""

    __tablename__ = "order_items"

    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    shop_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shop_items.id"))
    base_item_variant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("base_item_variants.id"))
    print_shop_profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("printshop_profiles.id"))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price_at_purchase: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    # Snapshots — the product can be renamed, re-priced, re-costed or deleted
    # after the sale, but the order must keep saying what was actually bought
    # and what it cost to make at the time.
    name_at_purchase: Mapped[str | None] = mapped_column(String, nullable=True)
    production_cost_at_purchase: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    # Design placement at purchase — renders the mockup the buyer actually saw.
    pos_x: Mapped[float | None] = mapped_column(nullable=True)
    pos_y: Mapped[float | None] = mapped_column(nullable=True)
    scale: Mapped[float | None] = mapped_column(nullable=True)
    rotation: Mapped[float | None] = mapped_column(nullable=True)
    fulfillment_status: Mapped[FulfillmentStatus] = mapped_column(
        SAEnum(FulfillmentStatus), default=FulfillmentStatus.PAID
    )

    order: Mapped["Order"] = relationship(back_populates="items")


class StoreVisit(UUIDMixin, Base):
    """One unique visitor per storefront per day (IP-hashed, no cookies).
    Deliberately coarse — enough for the analytics dashboard's visitors and
    conversion numbers without any tracking consent burden."""

    __tablename__ = "store_visits"
    __table_args__ = (UniqueConstraint("seller_profile_id", "day", "ip_hash", name="uq_visit"),)

    seller_profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("seller_profiles.id", ondelete="CASCADE")
    )
    day: Mapped[date] = mapped_column(Date)
    ip_hash: Mapped[str] = mapped_column(String)


class OrderEvent(UUIDMixin, TimestampMixin, Base):
    """Append-only order timeline — placed, paid, production, shipped, … Never
    updated or deleted, so the history a seller reads can't be rewritten."""

    __tablename__ = "order_events"

    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    type: Mapped[OrderEventType] = mapped_column(SAEnum(OrderEventType))
    note: Mapped[str | None] = mapped_column(String, nullable=True)

    order: Mapped["Order"] = relationship(back_populates="events")


class ProductReview(UUIDMixin, TimestampMixin, Base):
    """A verified-purchase rating + review for a product. One per (buyer,
    product). Auto-publishes; `status` flips to HIDDEN on report threshold or a
    future admin action. `reviewer_name` is a display snapshot so the card
    renders even if the account is later renamed."""

    __tablename__ = "product_reviews"
    __table_args__ = (UniqueConstraint("buyer_user_id", "shop_item_id", name="uq_review_one_per_product"),)

    shop_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("shop_items.id", ondelete="CASCADE"), index=True
    )
    buyer_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    # The delivered order that verified this purchase (audit trail).
    order_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    reviewer_name: Mapped[str] = mapped_column(String)
    rating: Mapped[int] = mapped_column(Integer)  # 1–5
    title: Mapped[str] = mapped_column(String)
    body: Mapped[str] = mapped_column(String)
    status: Mapped[ReviewStatus] = mapped_column(SAEnum(ReviewStatus), default=ReviewStatus.PUBLISHED)
    report_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    photos: Mapped[list["ReviewPhoto"]] = relationship(
        back_populates="review", cascade="all, delete-orphan", order_by="ReviewPhoto.created_at"
    )


class ReviewPhoto(UUIDMixin, TimestampMixin, Base):
    """A customer photo attached to a review (🔌 storage seam)."""

    __tablename__ = "review_photos"

    review_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("product_reviews.id", ondelete="CASCADE"))
    url: Mapped[str] = mapped_column(String)

    review: Mapped["ProductReview"] = relationship(back_populates="photos")


class ReviewReport(UUIDMixin, TimestampMixin, Base):
    """A report against a review. One per (review, reporter); the count drives
    auto-hide and, later, an admin moderation queue."""

    __tablename__ = "review_reports"
    __table_args__ = (UniqueConstraint("review_id", "reporter_user_id", name="uq_review_report"),)

    review_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("product_reviews.id", ondelete="CASCADE"))
    reporter_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    reason: Mapped[str | None] = mapped_column(String, nullable=True)


class WishlistItem(UUIDMixin, TimestampMixin, Base):
    """A product a buyer saved for later. One row per (buyer, product); the
    saved thing is the product, not a variant (size/colour is chosen at add-to-
    cart time). Persists server-side so the wishlist follows the buyer across
    devices; guests keep a local list that merges in on login."""

    __tablename__ = "wishlist_items"
    __table_args__ = (UniqueConstraint("buyer_user_id", "shop_item_id", name="uq_wishlist_item"),)

    buyer_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    shop_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shop_items.id", ondelete="CASCADE"))


class DiscountCode(UUIDMixin, TimestampMixin, Base):
    """A promotional code applied at checkout. Platform-wide when
    seller_profile_id is null, else valid only on that brand's orders.
    The discount is platform-absorbed — seller payout is unaffected."""

    __tablename__ = "discount_codes"

    code: Mapped[str] = mapped_column(String, unique=True, index=True)  # stored uppercased
    kind: Mapped[DiscountKind] = mapped_column(SAEnum(DiscountKind))
    value: Mapped[Decimal] = mapped_column(Numeric(10, 2))  # percent (0–100) or € amount
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    min_subtotal: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # null → valid on any brand; set → only that brand's cart.
    seller_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("seller_profiles.id", ondelete="CASCADE"), nullable=True
    )
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)  # null = unlimited
    used_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
