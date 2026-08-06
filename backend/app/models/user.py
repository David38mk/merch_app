import uuid
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import AccountType, AddressType, PlanCode, Role, SocialPlatform, StoreState


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    # Nullable: OAuth-only accounts (Google) have no local password.
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    first_name: Mapped[str] = mapped_column(String, server_default="")
    last_name: Mapped[str] = mapped_column(String, server_default="")
    display_name: Mapped[str] = mapped_column(String)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)  # optional buyer contact
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)  # 🔌 file storage
    # OAuth linkage — set when the account signed in via a provider (e.g. "google").
    auth_provider: Mapped[str | None] = mapped_column(String, nullable=True)
    # "Log out of all devices": access tokens issued before this moment are dead.
    sessions_revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Set on a Delete Account request — login blocked, all tokens dead, PII wiped.
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # When the user accepted Terms & Privacy. Null for guest (passwordless) accounts
    # created at checkout — they never went through signup.
    accepted_terms_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Separate consent to the Designer Agreement, recorded on designer signup.
    designer_agreement_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    roles: Mapped[list["UserRole"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    seller_profile: Mapped["SellerProfile | None"] = relationship(back_populates="user", uselist=False)
    designer_profile: Mapped["DesignerProfile | None"] = relationship(back_populates="user", uselist=False)
    printshop_profile: Mapped["PrintShopProfile | None"] = relationship(back_populates="user", uselist=False)
    settings: Mapped["Settings | None"] = relationship(back_populates="user", uselist=False)
    social_links: Mapped[list["SocialLink"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="user")  # noqa: F821


class UserRole(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role", name="uq_user_role"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[Role] = mapped_column(SAEnum(Role))

    user: Mapped["User"] = relationship(back_populates="roles")


class SellerProfile(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "seller_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    # Nullable until onboarding fills them in (profile is created during onboarding).
    slug: Mapped[str | None] = mapped_column(String, unique=True, index=True, nullable=True)
    store_name: Mapped[str | None] = mapped_column(String, nullable=True)  # the Brand name
    creator_name: Mapped[str | None] = mapped_column(String, nullable=True)
    bio: Mapped[str | None] = mapped_column(String, nullable=True)
    cover_url: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)  # the brand logo 🔌 storage
    store_state: Mapped[StoreState] = mapped_column(SAEnum(StoreState), default=StoreState.DRAFT)
    # First time the seller published the storefront (null while never published).
    # Also the flag that tells "Draft" (never published) apart from "Unpublished"
    # (was live, taken down) — the status is derived, never stored twice.
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Most recent publish/unpublish. Bumped on every one, so it doubles as the
    # cache key: the public page's ETag is built from it.
    storefront_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    last_published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── website builder ──────────────────────────────────────────────────────
    # Pending edits. The columns above/below stay the PUBLISHED truth the public
    # storefront reads, so editing never touches the live page until Publish.
    storefront_draft: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Published theme + store info + homepage curation.
    theme_primary: Mapped[str | None] = mapped_column(String, nullable=True)
    theme_accent: Mapped[str | None] = mapped_column(String, nullable=True)
    button_style: Mapped[str | None] = mapped_column(String, nullable=True)  # rounded | pill | square
    contact_email: Mapped[str | None] = mapped_column(String, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    # {"order": [shop_item_id...], "hidden": [...], "featured": [...]}
    curation: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Business information
    tax_id: Mapped[str | None] = mapped_column(String, nullable=True)  # VAT / tax number

    # Onboarding
    country: Mapped[str | None] = mapped_column(String, nullable=True)
    currency: Mapped[str | None] = mapped_column(String, nullable=True)
    account_type: Mapped[AccountType] = mapped_column(SAEnum(AccountType), default=AccountType.PERSONAL)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    plan_code: Mapped[PlanCode] = mapped_column(SAEnum(PlanCode), default=PlanCode.FREE)
    ai_credits_balance: Mapped[int] = mapped_column(Integer, default=0)

    # ⏭️🔌 billing — reserved, unused until Stripe seam is wired
    stripe_customer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    subscription_status: Mapped[str | None] = mapped_column(String, nullable=True)

    user: Mapped["User"] = relationship(back_populates="seller_profile")
    shop_items: Mapped[list["ShopItem"]] = relationship(back_populates="seller")  # noqa: F821
    designer_calls: Mapped[list["DesignerCall"]] = relationship(back_populates="seller")  # noqa: F821
    orders: Mapped[list["Order"]] = relationship(back_populates="seller")  # noqa: F821
    credit_transactions: Mapped[list["AICreditTransaction"]] = relationship(back_populates="seller")  # noqa: F821


class DesignerProfile(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "designer_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    slug: Mapped[str] = mapped_column(String, unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String)
    bio: Mapped[str | None] = mapped_column(String, nullable=True)
    cover_url: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    portfolio_state: Mapped[StoreState] = mapped_column(SAEnum(StoreState), default=StoreState.DRAFT)

    user: Mapped["User"] = relationship(back_populates="designer_profile")
    bids: Mapped[list["Bid"]] = relationship(back_populates="designer")  # noqa: F821


class PrintShopProfile(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "printshop_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)  # ⏭️ admin approval later

    user: Mapped["User"] = relationship(back_populates="printshop_profile")
    base_items: Mapped[list["BaseItem"]] = relationship(back_populates="print_shop")  # noqa: F821


class Settings(UUIDMixin, Base):
    __tablename__ = "settings"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    dark_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    language: Mapped[str] = mapped_column(String, default="en")
    # Buyer's preferred display currency (ISO code). Prices are € in this build;
    # this is a stored preference the storefront/checkout can honour once a real
    # FX/pricing layer lands.
    currency: Mapped[str] = mapped_column(String, default="EUR", server_default="EUR")
    timezone: Mapped[str | None] = mapped_column(String, nullable=True)
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    receive_newsletters: Mapped[bool] = mapped_column(Boolean, default=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)  # 🔌 email seam
    birthday: Mapped[date | None] = mapped_column(nullable=True)
    gender: Mapped[str | None] = mapped_column(String, nullable=True)

    user: Mapped["User"] = relationship(back_populates="settings")


class PayoutDetails(UUIDMixin, Base):
    __tablename__ = "payout_details"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    account_number: Mapped[str | None] = mapped_column(String, nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String, nullable=True)
    full_name: Mapped[str | None] = mapped_column(String, nullable=True)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)  # ⏭️


class Address(UUIDMixin, TimestampMixin, Base):
    """A buyer's saved address. Tagged SHIPPING or BILLING, with at most one
    default per type (enforced in the router). Used to prefill checkout."""

    __tablename__ = "addresses"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    address_type: Mapped[AddressType] = mapped_column(SAEnum(AddressType))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)  # default within its type

    full_name: Mapped[str] = mapped_column(String)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    line1: Mapped[str] = mapped_column(String)
    line2: Mapped[str | None] = mapped_column(String, nullable=True)
    city: Mapped[str] = mapped_column(String)
    region: Mapped[str | None] = mapped_column(String, nullable=True)  # state / province
    postal_code: Mapped[str] = mapped_column(String)
    country: Mapped[str] = mapped_column(String)


class SocialLink(UUIDMixin, Base):
    __tablename__ = "social_links"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    platform: Mapped[SocialPlatform] = mapped_column(SAEnum(SocialPlatform))
    url: Mapped[str] = mapped_column(String)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)  # ⏭️🔌 OAuth
    followers_count: Mapped[int | None] = mapped_column(Integer, nullable=True)  # ⏭️🔌 OAuth

    user: Mapped["User"] = relationship(back_populates="social_links")
