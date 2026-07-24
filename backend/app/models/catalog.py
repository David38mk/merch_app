import uuid
from decimal import Decimal

from sqlalchemy import Boolean, Enum as SAEnum, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import PrintOptionKind


class ItemCategory(UUIDMixin, Base):
    __tablename__ = "item_categories"

    name: Mapped[str] = mapped_column(String, unique=True)

    base_items: Mapped[list["BaseItem"]] = relationship(back_populates="category")


class BaseItem(UUIDMixin, TimestampMixin, Base):
    """A blank product a PrintShop offers. Sellers design on it."""

    __tablename__ = "base_items"

    print_shop_profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("printshop_profiles.id", ondelete="CASCADE"))
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("item_categories.id"), nullable=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    base_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)  # 🔌 storage — blank photo
    production_time: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. "3–5 business days"
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    print_shop: Mapped["PrintShopProfile"] = relationship(back_populates="base_items")  # noqa: F821
    category: Mapped["ItemCategory | None"] = relationship(back_populates="base_items")
    variants: Mapped[list["BaseItemVariant"]] = relationship(back_populates="base_item", cascade="all, delete-orphan")
    print_options: Mapped[list["PrintOption"]] = relationship(back_populates="base_item", cascade="all, delete-orphan")
    print_areas: Mapped[list["PrintArea"]] = relationship(back_populates="base_item", cascade="all, delete-orphan")
    shop_items: Mapped[list["ShopItem"]] = relationship(back_populates="base_item")  # noqa: F821


class BaseItemVariant(UUIDMixin, Base):
    """A purchasable size+color combo of a BaseItem."""

    __tablename__ = "base_item_variants"

    base_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("base_items.id", ondelete="CASCADE"))
    size: Mapped[str] = mapped_column(String)
    color: Mapped[str] = mapped_column(String)
    price_delta: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)

    base_item: Mapped["BaseItem"] = relationship(back_populates="variants")


class PrintOption(UUIDMixin, Base):
    __tablename__ = "print_options"

    base_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("base_items.id", ondelete="CASCADE"))
    kind: Mapped[PrintOptionKind] = mapped_column(SAEnum(PrintOptionKind))
    name: Mapped[str] = mapped_column(String)
    price_delta: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)

    base_item: Mapped["BaseItem"] = relationship(back_populates="print_options")


class PrintArea(UUIDMixin, Base):
    """A printable region on a blank (front, back, …)."""

    __tablename__ = "print_areas"

    base_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("base_items.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String)

    base_item: Mapped["BaseItem"] = relationship(back_populates="print_areas")


class CatalogFavorite(UUIDMixin, TimestampMixin, Base):
    """A seller's saved/favorited blank. Keyed by user so it works pre-profile."""

    __tablename__ = "catalog_favorites"
    __table_args__ = (UniqueConstraint("user_id", "base_item_id", name="uq_catalog_favorite"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    base_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("base_items.id", ondelete="CASCADE"))
