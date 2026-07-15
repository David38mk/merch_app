import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import (
    BidStatus,
    CallStatus,
    CollabState,
    PaymentType,
    SubmissionDecision,
    SubmissionKind,
)


class DesignerCall(UUIDMixin, TimestampMixin, Base):
    """A Seller's job posting to hire a Designer."""

    __tablename__ = "designer_calls"

    seller_profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("seller_profiles.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String)
    brief: Mapped[str] = mapped_column(String)
    reference_image_url: Mapped[str | None] = mapped_column(String, nullable=True)  # 🔌 storage
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payment_type: Mapped[PaymentType] = mapped_column(SAEnum(PaymentType), default=PaymentType.FIXED)
    budget_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    status: Mapped[CallStatus] = mapped_column(SAEnum(CallStatus), default=CallStatus.OPEN)

    seller: Mapped["SellerProfile"] = relationship(back_populates="designer_calls")  # noqa: F821
    bids: Mapped[list["Bid"]] = relationship(back_populates="call", cascade="all, delete-orphan")


class Bid(UUIDMixin, TimestampMixin, Base):
    """A Designer's price offer on a DesignerCall."""

    __tablename__ = "bids"

    call_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("designer_calls.id", ondelete="CASCADE"))
    designer_profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("designer_profiles.id", ondelete="CASCADE"))
    price_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    message: Mapped[str] = mapped_column(String)
    status: Mapped[BidStatus] = mapped_column(SAEnum(BidStatus), default=BidStatus.PENDING)

    call: Mapped["DesignerCall"] = relationship(back_populates="bids")
    designer: Mapped["DesignerProfile"] = relationship(back_populates="bids")  # noqa: F821


class Collaboration(UUIDMixin, TimestampMixin, Base):
    """Created when a Seller accepts a Bid. Walks a state machine to a finished product."""

    __tablename__ = "collaborations"

    call_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("designer_calls.id"))
    bid_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bids.id"))
    seller_profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("seller_profiles.id"))
    designer_profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("designer_profiles.id"))
    agreed_price_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    agreed_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    state: Mapped[CollabState] = mapped_column(SAEnum(CollabState), default=CollabState.PENDING)
    shop_item_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("shop_items.id"), nullable=True)

    submissions: Mapped[list["CollabSubmission"]] = relationship(
        back_populates="collab", cascade="all, delete-orphan"
    )
    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="collab", cascade="all, delete-orphan")


class CollabSubmission(UUIDMixin, TimestampMixin, Base):
    """A preview or final artifact submitted in a Collaboration, with the seller's decision."""

    __tablename__ = "collab_submissions"

    collab_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("collaborations.id", ondelete="CASCADE"))
    kind: Mapped[SubmissionKind] = mapped_column(SAEnum(SubmissionKind))
    design_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("designs.id"), nullable=True)
    resource_url: Mapped[str | None] = mapped_column(String, nullable=True)  # 🔌 storage
    submitted_by_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    decision: Mapped[SubmissionDecision] = mapped_column(SAEnum(SubmissionDecision), default=SubmissionDecision.PENDING)
    feedback: Mapped[str | None] = mapped_column(String, nullable=True)

    collab: Mapped["Collaboration"] = relationship(back_populates="submissions")


class ChatMessage(UUIDMixin, TimestampMixin, Base):
    """A message in a Collaboration thread. 🔌 real-time later; polled for MVP."""

    __tablename__ = "chat_messages"

    collab_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("collaborations.id", ondelete="CASCADE"))
    sender_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(String)
    seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    collab: Mapped["Collaboration"] = relationship(back_populates="messages")
