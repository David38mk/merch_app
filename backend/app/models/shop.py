import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Numeric,
    String,
    func,
)
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

    # DesignPosition, folded in (single placement for MVP). pos_x/pos_y are the
    # design centre as a % of the blank; scale is width as a fraction of the blank.
    pos_x: Mapped[float] = mapped_column(Float, default=0)
    pos_y: Mapped[float] = mapped_column(Float, default=0)
    scale: Mapped[float] = mapped_column(Float, default=1)
    rotation: Mapped[float] = mapped_column(Float, default=0, server_default="0")

    # The variant + options the seller chose. Kept alongside production_cost (which
    # is derived from them) so the editor can show and change the actual selection
    # rather than guessing it back out of a price.
    color: Mapped[str | None] = mapped_column(String, nullable=True)
    size: Mapped[str | None] = mapped_column(String, nullable=True)
    material: Mapped[str | None] = mapped_column(String, nullable=True)
    print_type: Mapped[str | None] = mapped_column(String, nullable=True)

    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    tags: Mapped[str | None] = mapped_column(String, nullable=True)  # comma-separated keywords (SEO / search seam)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))  # retail / customer price
    # Snapshot of the print cost for the chosen variant+options, so earnings stay
    # computable without re-deriving from the (buyer-chosen) variant later.
    production_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, server_default="0")
    state: Mapped[ShopItemState] = mapped_column(SAEnum(ShopItemState), default=ShopItemState.UNLISTED)
    # "Last updated" on the product card. Only ShopItem needs it (it's the one
    # entity sellers edit repeatedly), so it lives here rather than in the mixin.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    release_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # ⏭️
    only_followers: Mapped[bool] = mapped_column(Boolean, default=False)  # ⏭️🔌 follower-gating

    seller: Mapped["SellerProfile"] = relationship(back_populates="shop_items")  # noqa: F821
    base_item: Mapped["BaseItem"] = relationship(back_populates="shop_items")  # noqa: F821
    revisions: Mapped[list["ShopItemRevision"]] = relationship(
        back_populates="item", cascade="all, delete-orphan", order_by="ShopItemRevision.created_at.desc()"
    )


class ShopItemRevision(UUIDMixin, TimestampMixin, Base):
    """Append-only record of one save. Never updated, never deleted (except with
    its product), so an edit that overwrites a good price stays recoverable."""

    __tablename__ = "shop_item_revisions"

    shop_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shop_items.id", ondelete="CASCADE"))
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    # Human-readable lines: ["Price €29.00 → €34.00", "Design replaced"].
    summary: Mapped[list] = mapped_column(JSON, default=list)
    # Full before-values of the fields that changed, for a future restore.
    before: Mapped[dict] = mapped_column(JSON, default=dict)

    item: Mapped["ShopItem"] = relationship(back_populates="revisions")
