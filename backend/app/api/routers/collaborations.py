"""Collaboration workspace: where a seller and the designer they hired work from
first draft to approved product. Every action appends to an immutable event log,
so the full history survives after completion."""

import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.notify import push
from app.core.pricing import commission_rate, min_price
from app.models.catalog import BaseItem
from app.models.design import Design
from app.models.enums import (
    CollabEventType,
    CollabState,
    DesignSource,
    DesignType,
    NotificationType,
    PaymentType,
    ShopItemState,
    SubmissionDecision,
    SubmissionKind,
)
from app.models.hiring import ChatMessage, CollabEvent, CollabSubmission, Collaboration, DesignerCall
from app.models.shop import ShopItem
from app.models.user import DesignerProfile, SellerProfile, User
from app.seams.payments import pay_designer
from app.seams.storage import StorageError, save_design_image

router = APIRouter(prefix="/collaborations", tags=["collaborations"])

# Derived workspace stages (what the timeline highlights as "current").
STAGES = [
    "PENDING",
    "DESIGNER_STARTED",
    "FIRST_DRAFT_SUBMITTED",
    "REVISION_REQUESTED",
    "UPDATED_DESIGN_SUBMITTED",
    "DRAFT_APPROVED",
    "SELLER_REVIEWING",
    "FINAL_APPROVAL",
    "PAYMENT_PENDING",
    "COMPLETED",
]


# ── schemas ────────────────────────────────────────────────────────────────────

class PartyOut(BaseModel):
    name: str
    avatar_url: str | None = None
    slug: str | None = None


class EventOut(BaseModel):
    id: uuid.UUID
    type: CollabEventType
    note: str | None
    actor_name: str | None
    created_at: datetime


class SubmissionOut(BaseModel):
    id: uuid.UUID
    kind: SubmissionKind
    resource_url: str | None
    decision: SubmissionDecision
    feedback: str | None
    created_at: datetime


class MessageOut(BaseModel):
    id: uuid.UUID
    body: str
    mine: bool
    sender_name: str
    created_at: datetime


class CollabOut(BaseModel):
    id: uuid.UUID
    state: CollabState
    stage: str
    my_role: str  # "seller" | "designer"
    title: str
    brief: str | None
    deadline: datetime | None
    payment_type: PaymentType | None
    agreed_price_amount: Decimal | None
    agreed_percent: Decimal | None
    needs_payment: bool
    paid: bool
    base_name: str | None
    base_image_url: str | None
    seller: PartyOut
    designer: PartyOut
    shop_item_id: uuid.UUID | None
    submissions: list[SubmissionOut]
    events: list[EventOut]
    created_at: datetime


class CollabListItem(BaseModel):
    id: uuid.UUID
    title: str
    stage: str
    my_role: str
    counterpart: str
    base_image_url: str | None
    deadline: datetime | None
    created_at: datetime


class MessageIn(BaseModel):
    body: str = Field(min_length=1)


class FeedbackIn(BaseModel):
    feedback: str = Field(min_length=1)


# ── helpers ────────────────────────────────────────────────────────────────────

_LOADERS = (
    selectinload(Collaboration.submissions),
    selectinload(Collaboration.events),
)


def _load(db: Session, collab_id: uuid.UUID) -> Collaboration | None:
    # populate_existing: we re-load right after committing, and without it SQLAlchemy
    # hands back the identity-mapped instance with its stale events/submissions lists.
    return db.scalar(
        select(Collaboration)
        .where(Collaboration.id == collab_id)
        .options(*_LOADERS)
        .execution_options(populate_existing=True)
    )


def _parties(db: Session, collab: Collaboration) -> tuple[SellerProfile | None, DesignerProfile | None]:
    return (
        db.get(SellerProfile, collab.seller_profile_id),
        db.get(DesignerProfile, collab.designer_profile_id),
    )


def _role(db: Session, collab: Collaboration, user: User) -> str:
    seller, designer = _parties(db, collab)
    if seller and seller.user_id == user.id:
        return "seller"
    if designer and designer.user_id == user.id:
        return "designer"
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You're not part of this collaboration.")


def _log(db: Session, collab: Collaboration, type_: CollabEventType, user: User | None, note: str | None = None) -> None:
    db.add(
        CollabEvent(
            collab_id=collab.id, type=type_, actor_user_id=user.id if user else None, note=note
        )
    )


def _has_event(collab: Collaboration, type_: CollabEventType) -> bool:
    return any(e.type == type_ for e in collab.events)


def _stage(collab: Collaboration) -> str:
    """Derived from state + the event log, so it can never drift from reality."""
    if collab.state == CollabState.COMPLETED:
        return "COMPLETED"
    if collab.state == CollabState.PAYMENT:
        return "PAYMENT_PENDING"
    if collab.state == CollabState.FINAL_ACCEPTED:
        return "FINAL_APPROVAL"
    if collab.state == CollabState.FINAL:
        return "SELLER_REVIEWING"
    if collab.state == CollabState.PREVIEW_ACCEPTED:
        return "DRAFT_APPROVED"
    if collab.state == CollabState.PREVIEW:
        latest = max(collab.submissions, key=lambda s: s.created_at, default=None)
        if latest is not None and latest.decision == SubmissionDecision.DECLINED:
            return "REVISION_REQUESTED"
        return (
            "UPDATED_DESIGN_SUBMITTED"
            if _has_event(collab, CollabEventType.REVISION_REQUESTED)
            else "FIRST_DRAFT_SUBMITTED"
        )
    return "DESIGNER_STARTED" if _has_event(collab, CollabEventType.STARTED) else "PENDING"


def _call(db: Session, collab: Collaboration) -> DesignerCall | None:
    return db.scalar(
        select(DesignerCall)
        .where(DesignerCall.id == collab.call_id)
        .options(selectinload(DesignerCall.base_item))
    )


def _needs_payment(call: DesignerCall | None, collab: Collaboration) -> bool:
    """Only fixed-fee deals have something to settle here; revenue share is per-sale."""
    if call is None:
        return False
    return call.payment_type in (PaymentType.FIXED, PaymentType.BOTH) and bool(collab.agreed_price_amount)


def _out(db: Session, collab: Collaboration, user: User, role: str) -> CollabOut:
    seller, designer = _parties(db, collab)
    call = _call(db, collab)
    names = {}
    if seller:
        su = db.get(User, seller.user_id)
        names[seller.user_id] = seller.store_name or (su.display_name if su else "Seller")
    if designer:
        names[designer.user_id] = designer.display_name

    return CollabOut(
        id=collab.id,
        state=collab.state,
        stage=_stage(collab),
        my_role=role,
        title=call.title if call else "Collaboration",
        brief=call.brief if call else None,
        deadline=call.deadline if call else None,
        payment_type=call.payment_type if call else None,
        agreed_price_amount=collab.agreed_price_amount,
        agreed_percent=collab.agreed_percent,
        needs_payment=_needs_payment(call, collab),
        paid=_has_event(collab, CollabEventType.PAYMENT_COMPLETED),
        base_name=call.base_item.name if call and call.base_item else None,
        base_image_url=call.base_item.image_url if call and call.base_item else None,
        seller=PartyOut(
            name=(seller.store_name if seller and seller.store_name else "Seller"),
            avatar_url=seller.avatar_url if seller else None,
        ),
        designer=PartyOut(
            name=designer.display_name if designer else "Designer",
            avatar_url=designer.avatar_url if designer else None,
            slug=designer.slug if designer else None,
        ),
        shop_item_id=collab.shop_item_id,
        submissions=[
            SubmissionOut(
                id=s.id,
                kind=s.kind,
                resource_url=s.resource_url,
                decision=s.decision,
                feedback=s.feedback,
                created_at=s.created_at,
            )
            for s in sorted(collab.submissions, key=lambda s: s.created_at)
        ],
        events=[
            EventOut(
                id=e.id,
                type=e.type,
                note=e.note,
                actor_name=names.get(e.actor_user_id) if e.actor_user_id else None,
                created_at=e.created_at,
            )
            for e in sorted(collab.events, key=lambda e: e.created_at)
        ],
        created_at=collab.created_at,
    )


def _notify_counterpart(db: Session, collab: Collaboration, role: str, title: str, body: str) -> None:
    seller, designer = _parties(db, collab)
    target = designer if role == "seller" else seller
    if target:
        push(
            db,
            target.user_id,
            NotificationType.COLLAB_UPDATE,
            title,
            body,
            link_url=f"/collaborations/{collab.id}",
        )


def _complete(db: Session, collab: Collaboration, user: User) -> None:
    """Approve → (payment) → create the seller's draft product and close it out."""
    call = _call(db, collab)
    seller = db.get(SellerProfile, collab.seller_profile_id)

    final = next(
        (
            s
            for s in sorted(collab.submissions, key=lambda s: s.created_at, reverse=True)
            if s.kind == SubmissionKind.FINAL and s.decision == SubmissionDecision.ACCEPTED
        ),
        None,
    )
    if call and call.base_item and final and final.design_id and seller and collab.shop_item_id is None:
        cost = Decimal(call.base_item.base_price)
        rate = commission_rate(seller.plan_code)
        item = ShopItem(
            seller_profile_id=seller.id,
            base_item_id=call.base_item_id,
            design_id=final.design_id,
            pos_x=50,
            pos_y=45,
            scale=0.45,
            rotation=0,
            name=call.title,
            description=call.brief,
            price=min_price(cost, rate),  # seller edits before publishing
            production_cost=cost,
            state=ShopItemState.UNLISTED,  # lands in My Products as a Draft
        )
        db.add(item)
        db.flush()
        collab.shop_item_id = item.id
        _log(db, collab, CollabEventType.PRODUCT_CREATED, None, f"Draft product “{item.name}” created")
        push(
            db,
            db.get(User, seller.user_id).id,
            NotificationType.COLLAB_UPDATE,
            "Your product draft is ready",
            f"“{call.title}” was added to My Products as a draft — set your price and publish.",
            link_url="/seller/products",
        )

    collab.state = CollabState.COMPLETED
    _log(db, collab, CollabEventType.COMPLETED, user)


# ── endpoints ──────────────────────────────────────────────────────────────────

@router.get("", response_model=list[CollabListItem])
def my_collaborations(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CollabListItem]:
    seller = db.scalar(select(SellerProfile).where(SellerProfile.user_id == user.id))
    designer = db.scalar(select(DesignerProfile).where(DesignerProfile.user_id == user.id))
    if seller is None and designer is None:
        return []

    conditions = []
    if seller:
        conditions.append(Collaboration.seller_profile_id == seller.id)
    if designer:
        conditions.append(Collaboration.designer_profile_id == designer.id)

    rows = db.scalars(
        select(Collaboration)
        .where(or_(*conditions))
        .order_by(Collaboration.created_at.desc())
        .options(*_LOADERS)
    ).all()

    out: list[CollabListItem] = []
    for c in rows:
        call = _call(db, c)
        s, d = _parties(db, c)
        mine_seller = seller is not None and c.seller_profile_id == seller.id
        out.append(
            CollabListItem(
                id=c.id,
                title=call.title if call else "Collaboration",
                stage=_stage(c),
                my_role="seller" if mine_seller else "designer",
                counterpart=(d.display_name if mine_seller and d else (s.store_name if s else "Seller")) or "—",
                base_image_url=call.base_item.image_url if call and call.base_item else None,
                deadline=call.deadline if call else None,
                created_at=c.created_at,
            )
        )
    return out


@router.get("/{collab_id}", response_model=CollabOut)
def get_collaboration(
    collab_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CollabOut:
    collab = _load(db, collab_id)
    if collab is None:
        raise HTTPException(status_code=404, detail="Collaboration not found.")
    role = _role(db, collab, user)
    return _out(db, collab, user, role)


@router.post("/{collab_id}/start", response_model=CollabOut)
def start_work(
    collab_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CollabOut:
    collab = _load(db, collab_id)
    if collab is None:
        raise HTTPException(status_code=404, detail="Collaboration not found.")
    role = _role(db, collab, user)
    if role != "designer":
        raise HTTPException(status_code=403, detail="Only the designer can start the work.")
    if not _has_event(collab, CollabEventType.STARTED):
        _log(db, collab, CollabEventType.STARTED, user, "Designer started working")
        _notify_counterpart(db, collab, role, "Designer started", "Work has begun on your collaboration.")
        db.commit()
    return _out(db, _load(db, collab_id), user, role)


@router.post("/{collab_id}/submissions", response_model=CollabOut, status_code=status.HTTP_201_CREATED)
async def submit_work(
    collab_id: uuid.UUID,
    file: UploadFile = File(...),
    kind: SubmissionKind = Form(SubmissionKind.PREVIEW),
    note: str | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CollabOut:
    collab = _load(db, collab_id)
    if collab is None:
        raise HTTPException(status_code=404, detail="Collaboration not found.")
    role = _role(db, collab, user)
    if role != "designer":
        raise HTTPException(status_code=403, detail="Only the designer can upload work.")
    if collab.state in (CollabState.COMPLETED, CollabState.PAYMENT, CollabState.FINAL_ACCEPTED):
        raise HTTPException(status_code=400, detail="This collaboration is already finished.")

    data = await file.read()
    try:
        url = save_design_image(data, file.content_type)
    except StorageError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    design = Design(
        owner_user_id=user.id, type=DesignType.PAID, source=DesignSource.UPLOAD, resource_url=url
    )
    db.add(design)
    db.flush()

    db.add(
        CollabSubmission(
            collab_id=collab.id,
            kind=kind,
            design_id=design.id,
            resource_url=url,
            submitted_by_user_id=user.id,
        )
    )
    collab.state = CollabState.FINAL if kind == SubmissionKind.FINAL else CollabState.PREVIEW
    _log(
        db,
        collab,
        CollabEventType.FINAL_SUBMITTED if kind == SubmissionKind.FINAL else CollabEventType.DRAFT_SUBMITTED,
        user,
        note,
    )
    _notify_counterpart(
        db, collab, role, "New design submitted", "The designer uploaded new work for your review."
    )
    db.commit()
    return _out(db, _load(db, collab_id), user, role)


@router.post("/{collab_id}/submissions/{submission_id}/approve", response_model=CollabOut)
def approve_submission(
    collab_id: uuid.UUID,
    submission_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CollabOut:
    collab = _load(db, collab_id)
    if collab is None:
        raise HTTPException(status_code=404, detail="Collaboration not found.")
    role = _role(db, collab, user)
    if role != "seller":
        raise HTTPException(status_code=403, detail="Only the seller can approve work.")

    sub = db.scalar(
        select(CollabSubmission).where(
            CollabSubmission.id == submission_id, CollabSubmission.collab_id == collab_id
        )
    )
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found.")
    if sub.decision != SubmissionDecision.PENDING:
        raise HTTPException(status_code=400, detail="That submission was already reviewed.")

    sub.decision = SubmissionDecision.ACCEPTED

    if sub.kind == SubmissionKind.PREVIEW:
        collab.state = CollabState.PREVIEW_ACCEPTED
        _log(db, collab, CollabEventType.DRAFT_APPROVED, user, "Draft approved — final files requested")
        _notify_counterpart(db, collab, role, "Draft approved", "Your draft was approved. Upload the final files.")
    else:
        collab.state = CollabState.FINAL_ACCEPTED
        _log(db, collab, CollabEventType.APPROVED, user, "Final design approved")
        _notify_counterpart(db, collab, role, "Design approved 🎉", "Your final design was approved.")
        call = _call(db, collab)
        if _needs_payment(call, collab):
            collab.state = CollabState.PAYMENT  # settle the fixed fee before closing
        else:
            _complete(db, collab, user)

    db.commit()
    return _out(db, _load(db, collab_id), user, role)


@router.post("/{collab_id}/submissions/{submission_id}/revise", response_model=CollabOut)
def request_revision(
    collab_id: uuid.UUID,
    submission_id: uuid.UUID,
    payload: FeedbackIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CollabOut:
    collab = _load(db, collab_id)
    if collab is None:
        raise HTTPException(status_code=404, detail="Collaboration not found.")
    role = _role(db, collab, user)
    if role != "seller":
        raise HTTPException(status_code=403, detail="Only the seller can request revisions.")

    sub = db.scalar(
        select(CollabSubmission).where(
            CollabSubmission.id == submission_id, CollabSubmission.collab_id == collab_id
        )
    )
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found.")
    if sub.decision != SubmissionDecision.PENDING:
        raise HTTPException(status_code=400, detail="That submission was already reviewed.")

    sub.decision = SubmissionDecision.DECLINED
    sub.feedback = payload.feedback.strip()
    collab.state = CollabState.PREVIEW  # back to the designer for another pass
    _log(db, collab, CollabEventType.REVISION_REQUESTED, user, sub.feedback)
    _notify_counterpart(db, collab, role, "Revision requested", sub.feedback[:120])
    db.commit()
    return _out(db, _load(db, collab_id), user, role)


@router.post("/{collab_id}/pay", response_model=CollabOut)
def complete_payment(
    collab_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CollabOut:
    collab = _load(db, collab_id)
    if collab is None:
        raise HTTPException(status_code=404, detail="Collaboration not found.")
    role = _role(db, collab, user)
    if role != "seller":
        raise HTTPException(status_code=403, detail="Only the seller can complete payment.")
    if collab.state != CollabState.PAYMENT:
        raise HTTPException(status_code=400, detail="There's nothing to pay right now.")

    pay_designer(str(collab.id), collab.agreed_price_amount)  # 🔌 payments seam (stubbed)
    _log(
        db,
        collab,
        CollabEventType.PAYMENT_COMPLETED,
        user,
        f"Paid €{collab.agreed_price_amount}",
    )
    _notify_counterpart(db, collab, role, "Payment sent", "The seller marked your fee as paid.")
    _complete(db, collab, user)
    db.commit()
    return _out(db, _load(db, collab_id), user, role)


# ── messages ─────────────────────────────────────────────────────────────────────

@router.get("/{collab_id}/messages", response_model=list[MessageOut])
def list_messages(
    collab_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[MessageOut]:
    collab = _load(db, collab_id)
    if collab is None:
        raise HTTPException(status_code=404, detail="Collaboration not found.")
    _role(db, collab, user)

    seller, designer = _parties(db, collab)
    names: dict[uuid.UUID, str] = {}
    if seller:
        su = db.get(User, seller.user_id)
        names[seller.user_id] = seller.store_name or (su.display_name if su else "Seller")
    if designer:
        names[designer.user_id] = designer.display_name

    rows = db.scalars(
        select(ChatMessage).where(ChatMessage.collab_id == collab_id).order_by(ChatMessage.created_at)
    ).all()
    return [
        MessageOut(
            id=m.id,
            body=m.body,
            mine=m.sender_user_id == user.id,
            sender_name=names.get(m.sender_user_id, "Someone"),
            created_at=m.created_at,
        )
        for m in rows
    ]


@router.post("/{collab_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def post_message(
    collab_id: uuid.UUID,
    payload: MessageIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageOut:
    collab = _load(db, collab_id)
    if collab is None:
        raise HTTPException(status_code=404, detail="Collaboration not found.")
    role = _role(db, collab, user)

    msg = ChatMessage(collab_id=collab_id, sender_user_id=user.id, body=payload.body.strip())
    db.add(msg)
    _notify_counterpart(db, collab, role, "New message", payload.body.strip()[:120])
    db.commit()
    db.refresh(msg)
    return MessageOut(
        id=msg.id, body=msg.body, mine=True, sender_name="You", created_at=msg.created_at
    )
