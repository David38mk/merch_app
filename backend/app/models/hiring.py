import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Column, DateTime, Enum as SAEnum, ForeignKey, Integer, Numeric, String, Table, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import (
    AttachmentKind,
    BidStatus,
    CallStatus,
    CollabEventType,
    CollabState,
    PaymentType,
    SubmissionDecision,
    SubmissionKind,
)


class DesignerCall(UUIDMixin, TimestampMixin, Base):
    """A Seller's job posting to hire a Designer, always tied to a base product."""

    __tablename__ = "designer_calls"

    seller_profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("seller_profiles.id", ondelete="CASCADE"))
    # The blank the design is for (required by the API; nullable for older rows).
    base_item_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("base_items.id"), nullable=True)
    title: Mapped[str] = mapped_column(String)
    brief: Mapped[str] = mapped_column(String)
    design_style: Mapped[str | None] = mapped_column(String, nullable=True)
    inspiration_notes: Mapped[str | None] = mapped_column(String, nullable=True)
    reference_image_url: Mapped[str | None] = mapped_column(String, nullable=True)  # ⏭️ legacy single ref
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    desired_launch_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payment_type: Mapped[PaymentType] = mapped_column(SAEnum(PaymentType), default=PaymentType.FIXED)
    budget_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    revenue_share_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    status: Mapped[CallStatus] = mapped_column(SAEnum(CallStatus), default=CallStatus.DRAFT)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    seller: Mapped["SellerProfile"] = relationship(back_populates="designer_calls")  # noqa: F821
    base_item: Mapped["BaseItem | None"] = relationship()  # noqa: F821
    bids: Mapped[list["Bid"]] = relationship(back_populates="call", cascade="all, delete-orphan")
    attachments: Mapped[list["CallAttachment"]] = relationship(
        back_populates="call", cascade="all, delete-orphan"
    )


class CallAttachment(UUIDMixin, TimestampMixin, Base):
    """A reference image or brand-guideline file on a DesignerCall. 🔌 storage."""

    __tablename__ = "call_attachments"

    call_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("designer_calls.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(String)
    kind: Mapped[AttachmentKind] = mapped_column(SAEnum(AttachmentKind), default=AttachmentKind.REFERENCE)

    call: Mapped["DesignerCall"] = relationship(back_populates="attachments")


# Portfolio projects a designer attaches to an application (many-to-many).
bid_projects = Table(
    "bid_projects",
    Base.metadata,
    Column("bid_id", ForeignKey("bids.id", ondelete="CASCADE"), primary_key=True),
    Column("project_id", ForeignKey("designer_projects.id", ondelete="CASCADE"), primary_key=True),
)


class Bid(UUIDMixin, TimestampMixin, Base):
    """A Designer's application to a DesignerCall — a short intro, a cover
    message, an optional compensation offer, and selected portfolio projects."""

    __tablename__ = "bids"

    call_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("designer_calls.id", ondelete="CASCADE"))
    designer_profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("designer_profiles.id", ondelete="CASCADE"))
    price_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    intro: Mapped[str | None] = mapped_column(String, nullable=True)  # one-line headline
    message: Mapped[str] = mapped_column(String)  # full cover message
    status: Mapped[BidStatus] = mapped_column(SAEnum(BidStatus), default=BidStatus.PENDING)

    call: Mapped["DesignerCall"] = relationship(back_populates="bids")
    designer: Mapped["DesignerProfile"] = relationship(back_populates="bids")  # noqa: F821
    projects: Mapped[list["DesignerProject"]] = relationship(secondary=bid_projects)  # noqa: F821


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
    events: Mapped[list["CollabEvent"]] = relationship(back_populates="collab", cascade="all, delete-orphan")


class CollabEvent(UUIDMixin, TimestampMixin, Base):
    """One entry in a collaboration's activity timeline. Append-only: rows are
    never mutated, so the full history survives after completion."""

    __tablename__ = "collab_events"

    collab_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collaborations.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[CollabEventType] = mapped_column(SAEnum(CollabEventType))
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    note: Mapped[str | None] = mapped_column(String, nullable=True)

    collab: Mapped["Collaboration"] = relationship(back_populates="events")


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


class DesignerReview(UUIDMixin, TimestampMixin, Base):
    """A rating a seller leaves for a designer after working together.

    `seller_profile_id` / `collab_id` are null for seeded demo reviews;
    `reviewer_name` is a display snapshot so the card renders either way.
    """

    __tablename__ = "designer_reviews"

    designer_profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("designer_profiles.id", ondelete="CASCADE"), index=True
    )
    seller_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("seller_profiles.id", ondelete="SET NULL"), nullable=True
    )
    collab_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("collaborations.id", ondelete="SET NULL"), nullable=True
    )
    reviewer_name: Mapped[str] = mapped_column(String)
    rating: Mapped[int] = mapped_column(Integer)  # 1–5
    comment: Mapped[str | None] = mapped_column(String, nullable=True)


class ChatMessage(UUIDMixin, TimestampMixin, Base):
    """A message in a Collaboration thread. 🔌 real-time later; polled for MVP."""

    __tablename__ = "chat_messages"

    collab_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("collaborations.id", ondelete="CASCADE"))
    sender_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(String)
    seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    collab: Mapped["Collaboration"] = relationship(back_populates="messages")
