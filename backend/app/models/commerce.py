import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import FulfillmentStatus, OrderStatus


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

    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    commission_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=0)  # snapshot of plan rate
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    seller_payout_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)

    stripe_payment_intent_id: Mapped[str | None] = mapped_column(nullable=True)  # ⏭️🔌 gateway
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    seller: Mapped["SellerProfile"] = relationship(back_populates="orders")  # noqa: F821
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")


class OrderItem(UUIDMixin, Base):
    """A purchased line. Also the PrintShop production-queue row (fulfillment_status)."""

    __tablename__ = "order_items"

    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    shop_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shop_items.id"))
    base_item_variant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("base_item_variants.id"))
    print_shop_profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("printshop_profiles.id"))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price_at_purchase: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    fulfillment_status: Mapped[FulfillmentStatus] = mapped_column(
        SAEnum(FulfillmentStatus), default=FulfillmentStatus.PAID
    )

    order: Mapped["Order"] = relationship(back_populates="items")
