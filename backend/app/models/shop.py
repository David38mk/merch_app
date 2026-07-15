import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, Float, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import ShopItemState


class ShopItem(UUIDMixin, TimestampMixin, Base):
    """A Seller's published product: BaseItem + Design placed in a PrintArea + price."""

    __tablename__ = "shop_items"

    seller_profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("seller_profiles.id", ondelete="CASCADE"))
    base_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("base_items.id"))
    design_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("designs.id"), nullable=True)
    print_area_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("print_areas.id"), nullable=True)

    # DesignPosition, folded in (single placement for MVP)
    pos_x: Mapped[float] = mapped_column(Float, default=0)
    pos_y: Mapped[float] = mapped_column(Float, default=0)
    scale: Mapped[float] = mapped_column(Float, default=1)

    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    state: Mapped[ShopItemState] = mapped_column(SAEnum(ShopItemState), default=ShopItemState.UNLISTED)

    release_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # ⏭️
    only_followers: Mapped[bool] = mapped_column(Boolean, default=False)  # ⏭️🔌 follower-gating

    seller: Mapped["SellerProfile"] = relationship(back_populates="shop_items")  # noqa: F821
    base_item: Mapped["BaseItem"] = relationship(back_populates="shop_items")  # noqa: F821
