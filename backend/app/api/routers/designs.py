import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.database import get_db
from app.models.enums import AICreditReason, DesignSource, DesignType, Role
from app.models.design import Design
from app.models.platform import AICreditTransaction
from app.models.user import SellerProfile, User
from app.seams.ai import generate_design_candidates
from app.seams.storage import StorageError, save_design_image

router = APIRouter(prefix="/designs", tags=["designs"])

STARTER_CREDITS = 10  # FREE plan monthly AI quota, granted once


class DesignOut(BaseModel):
    id: uuid.UUID
    resource_url: str
    source: str
    created_at: datetime


class GenerateRequest(BaseModel):
    prompt: str


class GenerateResponse(BaseModel):
    candidates: list[DesignOut]
    credits_remaining: int


class CreditsOut(BaseModel):
    balance: int


def _out(d: Design) -> DesignOut:
    return DesignOut(id=d.id, resource_url=d.resource_url, source=d.source.value, created_at=d.created_at)


def _ensure_profile(db: Session, user: User) -> SellerProfile:
    p = db.scalar(select(SellerProfile).where(SellerProfile.user_id == user.id))
    if p is None:
        p = SellerProfile(user_id=user.id)
        db.add(p)
        db.flush()
    return p


def _ensure_starter_credits(db: Session, profile: SellerProfile) -> None:
    """Grant the FREE AI quota once (idempotent via the PLAN_GRANT ledger row)."""
    granted = db.scalar(
        select(AICreditTransaction).where(
            AICreditTransaction.seller_profile_id == profile.id,
            AICreditTransaction.reason == AICreditReason.PLAN_GRANT,
        )
    )
    if granted is None:
        profile.ai_credits_balance += STARTER_CREDITS
        db.add(
            AICreditTransaction(
                seller_profile_id=profile.id, delta=STARTER_CREDITS, reason=AICreditReason.PLAN_GRANT
            )
        )


@router.get("/credits", response_model=CreditsOut)
def get_credits(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> CreditsOut:
    profile = _ensure_profile(db, user)
    _ensure_starter_credits(db, profile)
    db.commit()
    return CreditsOut(balance=profile.ai_credits_balance)


@router.get("/recent", response_model=list[DesignOut])
def recent_designs(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> list[DesignOut]:
    """The seller's recent uploads, for quick reuse."""
    rows = db.scalars(
        select(Design)
        .where(Design.owner_user_id == user.id, Design.source == DesignSource.UPLOAD)
        .order_by(Design.created_at.desc())
        .limit(12)
    ).all()
    return [_out(d) for d in rows]


@router.post("/upload", response_model=DesignOut, status_code=status.HTTP_201_CREATED)
async def upload_design(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> DesignOut:
    data = await file.read()
    try:
        url = save_design_image(data, file.content_type)
    except StorageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    design = Design(owner_user_id=user.id, type=DesignType.PERSONAL, source=DesignSource.UPLOAD, resource_url=url)
    db.add(design)
    db.commit()
    db.refresh(design)
    return _out(design)


@router.post("/generate", response_model=GenerateResponse)
def generate(
    payload: GenerateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> GenerateResponse:
    prompt = payload.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Enter a prompt to generate artwork.")

    profile = _ensure_profile(db, user)
    _ensure_starter_credits(db, profile)
    if profile.ai_credits_balance <= 0:
        db.commit()  # persist the (possible) grant even though we can't generate
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="You're out of AI credits. They reset monthly on the Free plan.",
        )

    # 🔌 seam: generate → store → persist as Design rows (candidates).
    candidates: list[Design] = []
    for png in generate_design_candidates(prompt, 4):
        url = save_design_image(png, "image/png")
        d = Design(owner_user_id=user.id, type=DesignType.PERSONAL, source=DesignSource.AI, resource_url=url)
        db.add(d)
        candidates.append(d)

    profile.ai_credits_balance -= 1
    db.add(
        AICreditTransaction(
            seller_profile_id=profile.id, delta=-1, reason=AICreditReason.AI_GENERATION
        )
    )
    db.commit()
    for d in candidates:
        db.refresh(d)

    return GenerateResponse(candidates=[_out(d) for d in candidates], credits_remaining=profile.ai_credits_balance)
