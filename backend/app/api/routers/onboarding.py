from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.database import get_db
from app.core.slug import unique_slug
from app.models.enums import Role
from app.models.user import SellerProfile, User
from app.schemas.onboarding import OnboardingState, OnboardingUpdate

router = APIRouter(prefix="/seller/onboarding", tags=["onboarding"])


def _profile(db: Session, user: User) -> SellerProfile | None:
    return db.scalar(select(SellerProfile).where(SellerProfile.user_id == user.id))


def _state(p: SellerProfile | None) -> OnboardingState:
    if p is None:
        return OnboardingState(completed=False)
    return OnboardingState(
        completed=p.onboarding_completed,
        brand_name=p.store_name,
        creator_name=p.creator_name,
        country=p.country,
        currency=p.currency,
        account_type=p.account_type,
    )


def _apply(db: Session, p: SellerProfile, payload: OnboardingUpdate) -> None:
    """Apply only the fields present in the payload (partial autosave)."""
    if payload.brand_name is not None:
        p.store_name = payload.brand_name
        p.slug = unique_slug(db, payload.brand_name, exclude_id=p.id)
    if payload.creator_name is not None:
        p.creator_name = payload.creator_name
    if payload.country is not None:
        p.country = payload.country
    if payload.currency is not None:
        p.currency = payload.currency
    if payload.account_type is not None:
        p.account_type = payload.account_type


def _ensure_profile(db: Session, user: User) -> SellerProfile:
    p = _profile(db, user)
    if p is None:
        p = SellerProfile(user_id=user.id)
        db.add(p)
    return p


@router.get("", response_model=OnboardingState)
def get_onboarding(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> OnboardingState:
    """Current onboarding state — used to prefill/resume and to redirect if completed."""
    return _state(_profile(db, user))


@router.patch("", response_model=OnboardingState)
def autosave_onboarding(
    payload: OnboardingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> OnboardingState:
    """Autosave one step. Creates the SellerProfile on first save (upsert)."""
    p = _ensure_profile(db, user)
    _apply(db, p, payload)
    db.commit()
    db.refresh(p)
    return _state(p)


@router.post("/complete", response_model=OnboardingState)
def complete_onboarding(
    payload: OnboardingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> OnboardingState:
    """Save any final fields, validate required ones, mark onboarding complete."""
    p = _ensure_profile(db, user)
    _apply(db, p, payload)

    missing = [
        label
        for label, value in (("brand name", p.store_name), ("country", p.country), ("currency", p.currency))
        if not value
    ]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Please provide: {', '.join(missing)}.",
        )

    if not p.slug and p.store_name:
        p.slug = unique_slug(db, p.store_name, exclude_id=p.id)
    p.onboarding_completed = True
    db.commit()
    db.refresh(p)
    return _state(p)
