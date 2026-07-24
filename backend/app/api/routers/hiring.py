"""Designer job calls: sellers post briefs, designers apply with bids, sellers
accept one (which opens a Collaboration). The 7-state job status shown in the UI
is *derived* from the call + its bids + its collaboration, so it can never drift."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.core.designer_stats import completed_counts, portfolio_previews, rating_stats, response_hours
from app.core.notify import push
from app.models.catalog import BaseItem
from app.models.enums import (
    AttachmentKind,
    BidStatus,
    CallStatus,
    CollabState,
    NotificationType,
    PaymentType,
    Role,
)
from app.models.hiring import Bid, CallAttachment, Collaboration, DesignerCall
from app.models.user import DesignerProfile, SellerProfile, User
from app.seams.storage import StorageError, copy_stored_file, delete_image, save_attachment

router = APIRouter(prefix="/designer-calls", tags=["hiring"])

MIN_PERCENT = Decimal("1")
MAX_PERCENT = Decimal("50")

# Derived display statuses (what the seller's hub shows).
DRAFT = "DRAFT"
OPEN = "OPEN"
IN_REVIEW = "IN_REVIEW"
DESIGNER_SELECTED = "DESIGNER_SELECTED"
IN_PROGRESS = "IN_PROGRESS"
COMPLETED = "COMPLETED"
CLOSED = "CLOSED"


# ── schemas ────────────────────────────────────────────────────────────────────

class AttachmentOut(BaseModel):
    id: uuid.UUID
    url: str
    kind: AttachmentKind


class DesignerBrief(BaseModel):
    id: uuid.UUID
    display_name: str
    slug: str
    avatar_url: str | None = None
    bio: str | None = None
    # Social proof shown on the applicant card (see core.designer_stats)
    rating_avg: float | None = None
    rating_count: int = 0
    completed_jobs: int = 0
    response_hours: float | None = None
    portfolio_preview: list[str] = []


class BidOut(BaseModel):
    id: uuid.UUID
    price_amount: Decimal | None
    percent: Decimal | None
    message: str
    status: BidStatus
    created_at: datetime
    designer: DesignerBrief


class CallOut(BaseModel):
    id: uuid.UUID
    title: str
    brief: str
    design_style: str | None
    inspiration_notes: str | None
    payment_type: PaymentType
    budget_amount: Decimal | None
    revenue_share_percent: Decimal | None
    deadline: datetime | None
    desired_launch_date: datetime | None
    status: CallStatus
    display_status: str
    base_item_id: uuid.UUID | None
    base_name: str | None
    base_image_url: str | None
    provider: str | None
    seller_brand: str | None
    attachments: list[AttachmentOut]
    bids_count: int
    editable: bool
    can_delete: bool
    has_applied: bool
    published_at: datetime | None
    collaboration_id: uuid.UUID | None
    created_at: datetime


class CallCreate(BaseModel):
    base_item_id: uuid.UUID
    title: str = Field(min_length=1)
    brief: str = Field(min_length=1)
    design_style: str | None = None
    inspiration_notes: str | None = None
    payment_type: PaymentType = PaymentType.FIXED
    budget_amount: Decimal | None = None
    revenue_share_percent: Decimal | None = None
    deadline: datetime | None = None
    desired_launch_date: datetime | None = None
    publish: bool = False


class CallPatch(BaseModel):
    title: str | None = None
    brief: str | None = None
    design_style: str | None = None
    inspiration_notes: str | None = None
    payment_type: PaymentType | None = None
    budget_amount: Decimal | None = None
    revenue_share_percent: Decimal | None = None
    deadline: datetime | None = None
    desired_launch_date: datetime | None = None
    publish: bool | None = None


class BidCreate(BaseModel):
    price_amount: Decimal | None = None
    percent: Decimal | None = None
    message: str = Field(min_length=1)


# ── helpers ────────────────────────────────────────────────────────────────────

_LOADERS = (
    selectinload(DesignerCall.base_item).selectinload(BaseItem.print_shop),
    selectinload(DesignerCall.attachments),
    selectinload(DesignerCall.bids),
    selectinload(DesignerCall.seller),
)


def _ensure_profile(db: Session, user: User) -> SellerProfile:
    p = db.scalar(select(SellerProfile).where(SellerProfile.user_id == user.id))
    if p is None:
        p = SellerProfile(user_id=user.id)
        db.add(p)
        db.flush()
    return p


def _designer_profile(db: Session, user: User) -> DesignerProfile | None:
    return db.scalar(select(DesignerProfile).where(DesignerProfile.user_id == user.id))


def _collabs_for(db: Session, call_ids: list[uuid.UUID]) -> dict[uuid.UUID, Collaboration]:
    if not call_ids:
        return {}
    rows = db.scalars(select(Collaboration).where(Collaboration.call_id.in_(call_ids))).all()
    return {c.call_id: c for c in rows}


def _display_status(call: DesignerCall, collab: Collaboration | None) -> str:
    """Derived from the underlying data — never stored, so it can't go stale."""
    if call.status == CallStatus.DRAFT:
        return DRAFT
    if call.status == CallStatus.CLOSED:
        return CLOSED
    if call.status == CallStatus.AWARDED:
        if collab is None or collab.state == CollabState.PENDING:
            return DESIGNER_SELECTED
        if collab.state == CollabState.COMPLETED:
            return COMPLETED
        return IN_PROGRESS
    # OPEN: waiting for applications, or has some to review
    return IN_REVIEW if any(b.status == BidStatus.PENDING for b in call.bids) else OPEN


def _editable(call: DesignerCall) -> bool:
    """Sellers can edit until a designer is accepted."""
    return call.status in (CallStatus.DRAFT, CallStatus.OPEN)


def _out(
    call: DesignerCall,
    collab: Collaboration | None = None,
    designer_profile_id: uuid.UUID | None = None,
) -> CallOut:
    base = call.base_item
    return CallOut(
        id=call.id,
        title=call.title,
        brief=call.brief,
        design_style=call.design_style,
        inspiration_notes=call.inspiration_notes,
        payment_type=call.payment_type,
        budget_amount=call.budget_amount,
        revenue_share_percent=call.revenue_share_percent,
        deadline=call.deadline,
        desired_launch_date=call.desired_launch_date,
        status=call.status,
        display_status=_display_status(call, collab),
        base_item_id=call.base_item_id,
        base_name=base.name if base else None,
        base_image_url=base.image_url if base else None,
        provider=base.print_shop.name if base and base.print_shop else None,
        seller_brand=call.seller.store_name if call.seller else None,
        attachments=[AttachmentOut(id=a.id, url=a.url, kind=a.kind) for a in call.attachments],
        bids_count=len(call.bids),
        editable=_editable(call),
        can_delete=call.status == CallStatus.DRAFT,
        has_applied=bool(
            designer_profile_id and any(b.designer_profile_id == designer_profile_id for b in call.bids)
        ),
        published_at=call.published_at,
        collaboration_id=collab.id if collab else None,
        created_at=call.created_at,
    )


def _validate_payment(ptype: PaymentType, amount: Decimal | None, percent: Decimal | None) -> None:
    if ptype in (PaymentType.FIXED, PaymentType.BOTH):
        if amount is None or amount <= 0:
            raise HTTPException(status_code=400, detail="Enter a fixed price greater than 0.")
    if ptype in (PaymentType.PERCENT, PaymentType.BOTH):
        if percent is None or not (MIN_PERCENT <= percent <= MAX_PERCENT):
            raise HTTPException(
                status_code=400, detail=f"Revenue share must be between {MIN_PERCENT}% and {MAX_PERCENT}%."
            )


def _validate_deadline(deadline: datetime | None) -> None:
    if deadline is None:
        return
    dl = deadline if deadline.tzinfo else deadline.replace(tzinfo=timezone.utc)
    if dl < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Deadline can't be in the past.")


def _load(db: Session, call_id: uuid.UUID) -> DesignerCall | None:
    return db.scalar(select(DesignerCall).where(DesignerCall.id == call_id).options(*_LOADERS))


def _owned(db: Session, call_id: uuid.UUID, profile: SellerProfile) -> DesignerCall:
    call = _load(db, call_id)
    if call is None or call.seller_profile_id != profile.id:
        raise HTTPException(status_code=404, detail="Job not found.")
    return call


def _one_collab(db: Session, call_id: uuid.UUID) -> Collaboration | None:
    return db.scalar(select(Collaboration).where(Collaboration.call_id == call_id))


# ── designer marketplace (before /{call_id} so it isn't parsed as a UUID) ────────

@router.get("/marketplace", response_model=list[CallOut])
def marketplace(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CallOut]:
    rows = db.scalars(
        select(DesignerCall)
        .where(DesignerCall.status == CallStatus.OPEN)
        .order_by(DesignerCall.created_at.desc())
        .options(*_LOADERS)
    ).all()
    dp = _designer_profile(db, user)
    return [_out(c, None, dp.id if dp else None) for c in rows]


# ── seller: my job offers ────────────────────────────────────────────────────────

@router.get("", response_model=list[CallOut])
def my_calls(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> list[CallOut]:
    profile = _ensure_profile(db, user)
    db.commit()
    rows = db.scalars(
        select(DesignerCall)
        .where(DesignerCall.seller_profile_id == profile.id)
        .order_by(DesignerCall.created_at.desc())
        .options(*_LOADERS)
    ).all()
    collabs = _collabs_for(db, [c.id for c in rows])
    return [_out(c, collabs.get(c.id)) for c in rows]


@router.post("", response_model=CallOut, status_code=status.HTTP_201_CREATED)
def create_call(
    payload: CallCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> CallOut:
    profile = _ensure_profile(db, user)
    base = db.get(BaseItem, payload.base_item_id)
    if base is None:
        raise HTTPException(status_code=400, detail="Select a valid product for this job.")

    _validate_deadline(payload.deadline)
    if payload.publish:
        _validate_payment(payload.payment_type, payload.budget_amount, payload.revenue_share_percent)

    call = DesignerCall(
        seller_profile_id=profile.id,
        base_item_id=base.id,
        title=payload.title.strip(),
        brief=payload.brief.strip(),
        design_style=(payload.design_style or "").strip() or None,
        inspiration_notes=(payload.inspiration_notes or "").strip() or None,
        payment_type=payload.payment_type,
        budget_amount=payload.budget_amount,
        revenue_share_percent=payload.revenue_share_percent,
        deadline=payload.deadline,
        desired_launch_date=payload.desired_launch_date,
        status=CallStatus.OPEN if payload.publish else CallStatus.DRAFT,
        published_at=datetime.now(timezone.utc) if payload.publish else None,
    )
    db.add(call)
    db.commit()
    return _out(_load(db, call.id))


@router.get("/{call_id}", response_model=CallOut)
def get_call(
    call_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CallOut:
    call = _load(db, call_id)
    if call is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    profile = db.scalar(select(SellerProfile).where(SellerProfile.user_id == user.id))
    is_owner = profile is not None and call.seller_profile_id == profile.id
    if not is_owner and call.status == CallStatus.DRAFT:
        raise HTTPException(status_code=404, detail="Job not found.")
    dp = _designer_profile(db, user)
    return _out(call, _one_collab(db, call.id), dp.id if dp else None)


@router.patch("/{call_id}", response_model=CallOut)
def update_call(
    call_id: uuid.UUID,
    payload: CallPatch,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> CallOut:
    profile = _ensure_profile(db, user)
    call = _owned(db, call_id, profile)
    if not _editable(call):
        raise HTTPException(status_code=400, detail="This job can't be edited once a designer is accepted.")

    for field in (
        "title", "brief", "design_style", "inspiration_notes", "payment_type",
        "budget_amount", "revenue_share_percent", "deadline", "desired_launch_date",
    ):
        value = getattr(payload, field)
        if value is not None:
            if isinstance(value, str):
                value = value.strip() or None
            setattr(call, field, value)

    _validate_deadline(call.deadline)
    if payload.publish or call.status == CallStatus.OPEN:
        _validate_payment(call.payment_type, call.budget_amount, call.revenue_share_percent)
    if payload.publish is True:
        call.status = CallStatus.OPEN
        if call.published_at is None:
            call.published_at = datetime.now(timezone.utc)
    elif payload.publish is False and call.status == CallStatus.OPEN:
        call.status = CallStatus.DRAFT

    db.commit()
    return _out(_load(db, call_id), _one_collab(db, call_id))


@router.post("/{call_id}/close", response_model=CallOut)
def close_call(
    call_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> CallOut:
    """Stop accepting applications. Keeps the job and its bid history."""
    profile = _ensure_profile(db, user)
    call = _owned(db, call_id, profile)
    if call.status == CallStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Drafts aren't published — delete it instead.")
    call.status = CallStatus.CLOSED
    db.commit()
    return _out(_load(db, call_id), _one_collab(db, call_id))


@router.post("/{call_id}/duplicate", response_model=CallOut, status_code=status.HTTP_201_CREATED)
def duplicate_call(
    call_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> CallOut:
    """Copy the brief + attachments into a fresh DRAFT (never bids or status)."""
    profile = _ensure_profile(db, user)
    src = _owned(db, call_id, profile)

    copy = DesignerCall(
        seller_profile_id=profile.id,
        base_item_id=src.base_item_id,
        title=f"{src.title} (copy)",
        brief=src.brief,
        design_style=src.design_style,
        inspiration_notes=src.inspiration_notes,
        payment_type=src.payment_type,
        budget_amount=src.budget_amount,
        revenue_share_percent=src.revenue_share_percent,
        deadline=src.deadline,
        desired_launch_date=src.desired_launch_date,
        status=CallStatus.DRAFT,
    )
    db.add(copy)
    db.flush()
    for a in src.attachments:  # copy the files so deleting one job can't break the other
        db.add(CallAttachment(call_id=copy.id, url=copy_stored_file(a.url), kind=a.kind))
    db.commit()
    return _out(_load(db, copy.id))


@router.delete("/{call_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_call(
    call_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> None:
    profile = _ensure_profile(db, user)
    call = _owned(db, call_id, profile)
    if call.status != CallStatus.DRAFT:
        raise HTTPException(
            status_code=400, detail="Only drafts can be deleted — close the job instead to keep its history."
        )
    for a in call.attachments:
        delete_image(a.url)
    db.delete(call)
    db.commit()


# ── applications (bids) ──────────────────────────────────────────────────────────

def _bid_out(bid: Bid, stats: dict | None = None) -> BidOut:
    d = bid.designer
    s = (stats or {}).get(d.id, {})
    return BidOut(
        id=bid.id,
        price_amount=bid.price_amount,
        percent=bid.percent,
        message=bid.message,
        status=bid.status,
        created_at=bid.created_at,
        designer=DesignerBrief(
            id=d.id,
            display_name=d.display_name,
            slug=d.slug,
            avatar_url=d.avatar_url,
            bio=d.bio,
            rating_avg=s.get("rating_avg"),
            rating_count=s.get("rating_count", 0),
            completed_jobs=s.get("completed_jobs", 0),
            response_hours=s.get("response_hours"),
            portfolio_preview=s.get("portfolio_preview", []),
        ),
    )


def _designer_stats(db: Session, designer_ids: list[uuid.UUID]) -> dict:
    ratings = rating_stats(db, designer_ids)
    completed = completed_counts(db, designer_ids)
    hours = response_hours(db, designer_ids)
    previews = portfolio_previews(db, designer_ids)
    return {
        d: {
            "rating_avg": ratings.get(d, (None, 0))[0],
            "rating_count": ratings.get(d, (None, 0))[1],
            "completed_jobs": completed.get(d, 0),
            "response_hours": hours.get(d),
            "portfolio_preview": previews.get(d, []),
        }
        for d in designer_ids
    }


@router.get("/{call_id}/bids", response_model=list[BidOut])
def list_bids(
    call_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> list[BidOut]:
    profile = _ensure_profile(db, user)
    _owned(db, call_id, profile)
    rows = db.scalars(
        select(Bid)
        .where(Bid.call_id == call_id)
        .order_by(Bid.created_at.desc())
        .options(selectinload(Bid.designer))
    ).all()
    stats = _designer_stats(db, [b.designer_profile_id for b in rows])
    return [_bid_out(b, stats) for b in rows]


@router.post("/{call_id}/bids", response_model=BidOut, status_code=status.HTTP_201_CREATED)
def submit_bid(
    call_id: uuid.UUID,
    payload: BidCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.DESIGNER)),
) -> BidOut:
    designer = _designer_profile(db, user)
    if designer is None:
        raise HTTPException(status_code=400, detail="Set up your designer profile first.")

    call = _load(db, call_id)
    if call is None or call.status != CallStatus.OPEN:
        raise HTTPException(status_code=404, detail="This job isn't accepting applications.")
    if call.seller and call.seller.user_id == user.id:
        raise HTTPException(status_code=400, detail="You can't apply to your own job.")

    existing = db.scalar(
        select(Bid).where(Bid.call_id == call_id, Bid.designer_profile_id == designer.id)
    )
    if existing is not None:
        if existing.status != BidStatus.PENDING:
            raise HTTPException(status_code=400, detail="Your application has already been decided.")
        existing.price_amount = payload.price_amount
        existing.percent = payload.percent
        existing.message = payload.message.strip()
        bid = existing
    else:
        bid = Bid(
            call_id=call_id,
            designer_profile_id=designer.id,
            price_amount=payload.price_amount,
            percent=payload.percent,
            message=payload.message.strip(),
        )
        db.add(bid)
        if call.seller:
            push(
                db,
                call.seller.user_id,
                NotificationType.NEW_BID,
                "New application",
                f"{designer.display_name} applied to “{call.title}”.",
                link_url=f"/seller/hiring/{call.id}",
            )

    db.commit()
    db.refresh(bid)
    return _bid_out(bid)


def _notify_rejected(db: Session, bid: Bid, call: DesignerCall) -> None:
    designer = db.get(DesignerProfile, bid.designer_profile_id)
    if designer:
        push(
            db,
            designer.user_id,
            NotificationType.SYSTEM,
            "Application not selected",
            f"You weren't picked for “{call.title}” this time. Keep an eye on new job calls!",
            link_url="/designer",
        )


@router.post("/{call_id}/bids/{bid_id}/reject", response_model=BidOut)
def reject_bid(
    call_id: uuid.UUID,
    bid_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> BidOut:
    """Turn down one applicant. The job stays open so the seller keeps reviewing."""
    profile = _ensure_profile(db, user)
    call = _owned(db, call_id, profile)
    if call.status != CallStatus.OPEN:
        raise HTTPException(status_code=400, detail="This job is no longer taking applications.")

    bid = db.scalar(
        select(Bid).where(Bid.id == bid_id, Bid.call_id == call_id).options(selectinload(Bid.designer))
    )
    if bid is None:
        raise HTTPException(status_code=404, detail="Application not found.")
    if bid.status != BidStatus.PENDING:
        raise HTTPException(status_code=400, detail="That application has already been decided.")

    bid.status = BidStatus.REJECTED
    _notify_rejected(db, bid, call)
    db.commit()
    db.refresh(bid)
    return _bid_out(bid, _designer_stats(db, [bid.designer_profile_id]))


@router.post("/{call_id}/bids/{bid_id}/accept", response_model=CallOut)
def accept_bid(
    call_id: uuid.UUID,
    bid_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> CallOut:
    """Accept one application: award the call and open the collaboration."""
    profile = _ensure_profile(db, user)
    call = _owned(db, call_id, profile)
    if call.status != CallStatus.OPEN:
        raise HTTPException(status_code=400, detail="This job already has a designer or is closed.")

    bid = db.scalar(select(Bid).where(Bid.id == bid_id, Bid.call_id == call_id))
    if bid is None:
        raise HTTPException(status_code=404, detail="Application not found.")

    for other in call.bids:  # exactly one winner — everyone else is told too
        if other.id == bid.id:
            other.status = BidStatus.ACCEPTED
            continue
        if other.status == BidStatus.PENDING:
            _notify_rejected(db, other, call)
        other.status = BidStatus.REJECTED

    call.status = CallStatus.AWARDED
    db.add(
        Collaboration(
            call_id=call.id,
            bid_id=bid.id,
            seller_profile_id=profile.id,
            designer_profile_id=bid.designer_profile_id,
            agreed_price_amount=bid.price_amount,
            agreed_percent=bid.percent,
            state=CollabState.PENDING,
        )
    )
    designer = db.get(DesignerProfile, bid.designer_profile_id)
    if designer:
        push(
            db,
            designer.user_id,
            NotificationType.BID_ACCEPTED,
            "Your application was accepted 🎉",
            f"You've been picked for “{call.title}”.",
            link_url=f"/designer/calls/{call.id}",
        )
    db.commit()
    return _out(_load(db, call_id), _one_collab(db, call_id))


# ── attachments ──────────────────────────────────────────────────────────────────

@router.post("/{call_id}/attachments", response_model=AttachmentOut, status_code=status.HTTP_201_CREATED)
async def add_attachment(
    call_id: uuid.UUID,
    file: UploadFile = File(...),
    kind: AttachmentKind = Form(AttachmentKind.REFERENCE),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> AttachmentOut:
    profile = _ensure_profile(db, user)
    call = _owned(db, call_id, profile)
    data = await file.read()
    try:
        url = save_attachment(data, file.content_type)
    except StorageError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    att = CallAttachment(call_id=call.id, url=url, kind=kind)
    db.add(att)
    db.commit()
    db.refresh(att)
    return AttachmentOut(id=att.id, url=att.url, kind=att.kind)


@router.delete("/{call_id}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_attachment(
    call_id: uuid.UUID,
    attachment_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> None:
    profile = _ensure_profile(db, user)
    _owned(db, call_id, profile)
    att = db.get(CallAttachment, attachment_id)
    if att is None or att.call_id != call_id:
        raise HTTPException(status_code=404, detail="Attachment not found.")
    delete_image(att.url)
    db.delete(att)
    db.commit()
