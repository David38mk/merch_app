"""Designer profile self-service: any signed-in user can enable the designer role
so they can apply to job calls."""

import re
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.designer_stats import completed_counts, rating_stats, response_hours
from app.models.design import Design
from app.models.enums import Role
from app.models.hiring import DesignerReview
from app.models.user import DesignerProfile, User, UserRole

router = APIRouter(prefix="/designer", tags=["designer"])
# Public-facing designer profiles live under a separate prefix so /designer/me
# and /designer/enable can't be shadowed by a slug.
public_router = APIRouter(prefix="/designers", tags=["designer"])


class DesignerProfileOut(BaseModel):
    id: uuid.UUID
    display_name: str
    slug: str
    bio: str | None = None
    avatar_url: str | None = None


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "designer"


def unique_designer_slug(db: Session, name: str) -> str:
    base = _slugify(name)
    slug, i = base, 2
    while db.scalar(select(DesignerProfile).where(DesignerProfile.slug == slug)) is not None:
        slug = f"{base}-{i}"
        i += 1
    return slug


@router.get("/me", response_model=DesignerProfileOut | None)
def my_designer_profile(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DesignerProfile | None:
    return db.scalar(select(DesignerProfile).where(DesignerProfile.user_id == user.id))


@router.post("/enable", response_model=DesignerProfileOut)
def enable_designer(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DesignerProfile:
    """Add the DESIGNER role + a profile. Idempotent."""
    profile = db.scalar(select(DesignerProfile).where(DesignerProfile.user_id == user.id))
    if profile is None:
        profile = DesignerProfile(
            user_id=user.id,
            slug=unique_designer_slug(db, user.display_name or "designer"),
            display_name=user.display_name or "Designer",
            avatar_url=user.avatar_url,
        )
        db.add(profile)
    if Role.DESIGNER not in {ur.role for ur in user.roles}:
        db.add(UserRole(user_id=user.id, role=Role.DESIGNER))
    db.commit()
    db.refresh(profile)
    return profile


# ── public profile (portfolio + reviews) ─────────────────────────────────────────

class ReviewOut(BaseModel):
    id: uuid.UUID
    reviewer_name: str
    rating: int
    comment: str | None
    created_at: datetime


class PortfolioPiece(BaseModel):
    id: uuid.UUID
    resource_url: str
    source: str
    created_at: datetime


class DesignerPublicProfile(BaseModel):
    id: uuid.UUID
    slug: str
    display_name: str
    bio: str | None
    avatar_url: str | None
    cover_url: str | None
    rating_avg: float | None
    rating_count: int
    completed_jobs: int
    response_hours: float | None
    reviews: list[ReviewOut]
    portfolio: list[PortfolioPiece]


@public_router.get("/{slug}", response_model=DesignerPublicProfile)
def designer_profile(
    slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DesignerPublicProfile:
    p = db.scalar(select(DesignerProfile).where(DesignerProfile.slug == slug))
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Designer not found.")

    avg, count = rating_stats(db, [p.id]).get(p.id, (None, 0))
    reviews = db.scalars(
        select(DesignerReview)
        .where(DesignerReview.designer_profile_id == p.id)
        .order_by(DesignerReview.created_at.desc())
        .limit(10)
    ).all()
    portfolio = db.scalars(
        select(Design).where(Design.owner_user_id == p.user_id).order_by(Design.created_at.desc()).limit(12)
    ).all()

    return DesignerPublicProfile(
        id=p.id,
        slug=p.slug,
        display_name=p.display_name,
        bio=p.bio,
        avatar_url=p.avatar_url,
        cover_url=p.cover_url,
        rating_avg=avg,
        rating_count=count,
        completed_jobs=completed_counts(db, [p.id]).get(p.id, 0),
        response_hours=response_hours(db, [p.id]).get(p.id),
        reviews=[
            ReviewOut(
                id=r.id,
                reviewer_name=r.reviewer_name,
                rating=r.rating,
                comment=r.comment,
                created_at=r.created_at,
            )
            for r in reviews
        ],
        portfolio=[
            PortfolioPiece(
                id=d.id, resource_url=d.resource_url, source=d.source.value, created_at=d.created_at
            )
            for d in portfolio
        ],
    )
