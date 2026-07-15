import uuid
from decimal import Decimal

from sqlalchemy import Boolean, Enum as SAEnum, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import AICreditReason, NotificationType


class Notification(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[NotificationType] = mapped_column(SAEnum(NotificationType))
    title: Mapped[str] = mapped_column(String)
    body: Mapped[str] = mapped_column(String)
    link_url: Mapped[str | None] = mapped_column(String, nullable=True)
    seen: Mapped[bool] = mapped_column(Boolean, default=False)  # 🔌 email/push delivery is a seam

    user: Mapped["User"] = relationship(back_populates="notifications")  # noqa: F821


class Plan(Base):
    """Reference/config table for subscription tiers. Seeded, not user-created."""

    __tablename__ = "plans"

    code: Mapped[str] = mapped_column(String, primary_key=True)  # FREE / CREATOR / PRO
    monthly_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    commission_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4))  # e.g. 0.15
    product_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)  # null = unlimited
    ai_monthly_quota: Mapped[int] = mapped_column(Integer, default=0)


class AICreditTransaction(UUIDMixin, TimestampMixin, Base):
    """Optional ledger of AI credit movements. 🔌 real AI generation is stubbed."""

    __tablename__ = "ai_credit_transactions"

    seller_profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("seller_profiles.id", ondelete="CASCADE"))
    delta: Mapped[int] = mapped_column(Integer)
    reason: Mapped[AICreditReason] = mapped_column(SAEnum(AICreditReason))

    seller: Mapped["SellerProfile"] = relationship(back_populates="credit_transactions")  # noqa: F821
