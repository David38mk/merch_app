"""Designer profile self-service: any signed-in user can enable the designer role
so they can apply to job calls."""

import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings as app_settings
from app.core.database import get_db
from app.core.designer_stats import completed_counts, rating_stats, response_hours
from app.models.design import Design
from app.models.enums import Role
from app.models.hiring import DesignerReview
from app.models.user import (
    DesignerPortfolioItem,
    DesignerProfile,
    DesignerProject,
    DesignerProjectImage,
    User,
    UserRole,
)
from app.seams.storage import StorageError, delete_image, save_image

# The fixed onboarding vocabularies (also used to validate patches).
SKILL_OPTIONS = [
    "Graphic Design", "Illustration", "Typography", "Branding",
    "Streetwear", "Merchandise", "Logo Design", "Other",
]
EXPERIENCE_OPTIONS = ["Beginner", "Intermediate", "Professional"]
MAX_PORTFOLIO_LINKS = 10

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


# ── onboarding + profile editing ─────────────────────────────────────────────

class PortfolioItemOut(BaseModel):
    id: uuid.UUID
    image_url: str


class DesignerOnboardingOut(BaseModel):
    display_name: str
    bio: str | None
    country: str | None
    avatar_url: str | None
    cover_url: str | None
    skills: list[str]
    experience: str | None
    portfolio_links: list[str]
    portfolio_items: list[PortfolioItemOut]
    website: str | None
    behance: str | None
    dribbble: str | None
    instagram: str | None
    onboarding_completed: bool


class DesignerProfilePatch(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    bio: str | None = None
    country: str | None = None
    skills: list[str] | None = None
    experience: str | None = None
    portfolio_links: list[str] | None = None
    website: str | None = None
    behance: str | None = None
    dribbble: str | None = None
    instagram: str | None = None

    @field_validator("skills")
    @classmethod
    def _valid_skills(cls, v: list[str] | None) -> list[str] | None:
        if v is not None:
            bad = [s for s in v if s not in SKILL_OPTIONS]
            if bad:
                raise ValueError(f"Unknown skill(s): {', '.join(bad)}.")
        return v

    @field_validator("experience")
    @classmethod
    def _valid_experience(cls, v: str | None) -> str | None:
        if v and v not in EXPERIENCE_OPTIONS:
            raise ValueError("Experience must be Beginner, Intermediate or Professional.")
        return v

    @field_validator("portfolio_links")
    @classmethod
    def _clean_links(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        links = [x.strip() for x in v if x.strip()]
        if len(links) > MAX_PORTFOLIO_LINKS:
            raise ValueError(f"At most {MAX_PORTFOLIO_LINKS} portfolio links.")
        return links


def _my_profile(db: Session, user: User) -> DesignerProfile:
    p = db.scalar(select(DesignerProfile).where(DesignerProfile.user_id == user.id))
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No designer profile — enable it first.")
    return p


def _onboarding_out(p: DesignerProfile) -> DesignerOnboardingOut:
    return DesignerOnboardingOut(
        display_name=p.display_name,
        bio=p.bio,
        country=p.country,
        avatar_url=p.avatar_url,
        cover_url=p.cover_url,
        skills=list(p.skills or []),
        experience=p.experience,
        portfolio_links=list(p.portfolio_links or []),
        portfolio_items=[PortfolioItemOut(id=i.id, image_url=i.image_url) for i in p.portfolio_items],
        website=p.website,
        behance=p.behance,
        dribbble=p.dribbble,
        instagram=p.instagram,
        onboarding_completed=p.onboarding_completed_at is not None,
    )


@router.get("/onboarding/options")
def onboarding_options() -> dict:
    """The fixed skill + experience vocabularies for the wizard."""
    return {"skills": SKILL_OPTIONS, "experience": EXPERIENCE_OPTIONS}


@router.get("/onboarding", response_model=DesignerOnboardingOut)
def get_onboarding(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DesignerOnboardingOut:
    return _onboarding_out(_my_profile(db, user))


@router.patch("/profile", response_model=DesignerOnboardingOut)
def update_designer_profile(
    payload: DesignerProfilePatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DesignerOnboardingOut:
    """Save any subset of the onboarding fields (each step patches; all editable
    later). display_name also refreshes the profile's slug is left stable."""
    p = _my_profile(db, user)
    data = payload.model_dump(exclude_unset=True)
    if "display_name" in data and data["display_name"]:
        p.display_name = data["display_name"].strip()
    if "bio" in data:
        p.bio = (data["bio"] or "").strip() or None
    if "country" in data:
        p.country = (data["country"] or "").strip() or None
    if "skills" in data and data["skills"] is not None:
        p.skills = data["skills"]
    if "experience" in data:
        p.experience = data["experience"] or None
    if "portfolio_links" in data and data["portfolio_links"] is not None:
        p.portfolio_links = data["portfolio_links"]
    for field in ("website", "behance", "dribbble", "instagram"):
        if field in data:
            setattr(p, field, (data[field] or "").strip() or None)
    db.commit()
    db.refresh(p)
    return _onboarding_out(p)


@router.post("/avatar", response_model=DesignerOnboardingOut)
async def upload_designer_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DesignerOnboardingOut:
    p = _my_profile(db, user)
    data = await file.read()
    try:
        url = save_image(data, file.content_type, max_px=app_settings.LOGO_MAX_PX)
    except StorageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    old = p.avatar_url
    p.avatar_url = url
    db.commit()
    if old:
        delete_image(old)
    db.refresh(p)
    return _onboarding_out(p)


@router.post("/cover", response_model=DesignerOnboardingOut)
async def upload_designer_cover(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DesignerOnboardingOut:
    p = _my_profile(db, user)
    data = await file.read()
    try:
        url = save_image(data, file.content_type, max_px=app_settings.COVER_MAX_PX)
    except StorageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    old = p.cover_url
    p.cover_url = url
    db.commit()
    if old:
        delete_image(old)
    db.refresh(p)
    return _onboarding_out(p)


@router.post("/portfolio", response_model=PortfolioItemOut, status_code=status.HTTP_201_CREATED)
async def add_portfolio_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PortfolioItemOut:
    p = _my_profile(db, user)
    data = await file.read()
    try:
        url = save_image(data, file.content_type, max_px=app_settings.COVER_MAX_PX)
    except StorageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    item = DesignerPortfolioItem(designer_profile_id=p.id, image_url=url)
    db.add(item)
    db.commit()
    db.refresh(item)
    return PortfolioItemOut(id=item.id, image_url=item.image_url)


@router.delete("/portfolio/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_portfolio_image(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    p = _my_profile(db, user)
    item = db.get(DesignerPortfolioItem, item_id)
    if item is None or item.designer_profile_id != p.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio item not found.")
    url = item.image_url
    db.delete(item)
    db.commit()
    delete_image(url)


@router.post("/onboarding/complete", response_model=DesignerOnboardingOut)
def complete_onboarding(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DesignerOnboardingOut:
    p = _my_profile(db, user)
    if p.onboarding_completed_at is None:
        p.onboarding_completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(p)
    return _onboarding_out(p)


# ── portfolio projects ───────────────────────────────────────────────────────

MAX_PROJECT_IMAGES = 12


class ProjectImageOut(BaseModel):
    id: uuid.UUID
    image_url: str
    position: int


class ProjectOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    categories: list[str]
    featured: bool
    published: bool
    created_at: datetime
    cover_url: str | None
    images: list[ProjectImageOut]


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    categories: list[str] = Field(default_factory=list)

    @field_validator("categories")
    @classmethod
    def _valid_categories(cls, v: list[str]) -> list[str]:
        bad = [c for c in v if c not in SKILL_OPTIONS]
        if bad:
            raise ValueError(f"Unknown categories: {', '.join(bad)}")
        return v


class ProjectPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    categories: list[str] | None = None
    featured: bool | None = None

    @field_validator("categories")
    @classmethod
    def _valid_categories(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        bad = [c for c in v if c not in SKILL_OPTIONS]
        if bad:
            raise ValueError(f"Unknown categories: {', '.join(bad)}")
        return v


class ReorderIn(BaseModel):
    image_ids: list[uuid.UUID]


def _project_out(pr: DesignerProject) -> ProjectOut:
    imgs = sorted(pr.images, key=lambda i: i.position)
    return ProjectOut(
        id=pr.id,
        title=pr.title,
        description=pr.description,
        categories=list(pr.categories or []),
        featured=pr.featured,
        published=pr.published,
        created_at=pr.created_at,
        cover_url=imgs[0].image_url if imgs else None,
        images=[ProjectImageOut(id=i.id, image_url=i.image_url, position=i.position) for i in imgs],
    )


def _my_project(db: Session, user: User, project_id: uuid.UUID) -> DesignerProject:
    p = _my_profile(db, user)
    pr = db.get(DesignerProject, project_id)
    if pr is None or pr.designer_profile_id != p.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    return pr


@router.get("/projects", response_model=list[ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ProjectOut]:
    """The designer's own projects — drafts included (dashboard view). Featured
    first, then newest."""
    p = _my_profile(db, user)
    rows = db.scalars(
        select(DesignerProject)
        .where(DesignerProject.designer_profile_id == p.id)
        .order_by(DesignerProject.featured.desc(), DesignerProject.created_at.desc())
    ).all()
    return [_project_out(pr) for pr in rows]


@router.post("/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectOut:
    """Create a project as a DRAFT — images are uploaded next, then Publish makes
    it visible to sellers."""
    p = _my_profile(db, user)
    pr = DesignerProject(
        designer_profile_id=p.id,
        title=payload.title.strip(),
        description=(payload.description or "").strip() or None,
        categories=payload.categories,
    )
    db.add(pr)
    db.commit()
    db.refresh(pr)
    return _project_out(pr)


@router.patch("/projects/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: uuid.UUID,
    payload: ProjectPatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectOut:
    """Edit any subset of a project's fields (all editable at any time)."""
    pr = _my_project(db, user, project_id)
    data = payload.model_dump(exclude_unset=True)
    if "title" in data and data["title"]:
        pr.title = data["title"].strip()
    if "description" in data:
        pr.description = (data["description"] or "").strip() or None
    if "categories" in data and data["categories"] is not None:
        pr.categories = data["categories"]
    if "featured" in data and data["featured"] is not None:
        pr.featured = data["featured"]
    db.commit()
    db.refresh(pr)
    return _project_out(pr)


@router.post("/projects/{project_id}/publish", response_model=ProjectOut)
def set_project_published(
    project_id: uuid.UUID,
    published: bool = True,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectOut:
    """Publish (or unpublish) a project. A project needs at least one image to go
    public — sellers judge on the work, so an image-less project stays a draft."""
    pr = _my_project(db, user, project_id)
    if published and not pr.images:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Add at least one image before publishing.")
    pr.published = published
    db.commit()
    db.refresh(pr)
    return _project_out(pr)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    pr = _my_project(db, user, project_id)
    urls = [i.image_url for i in pr.images]
    db.delete(pr)
    db.commit()
    for url in urls:
        delete_image(url)


@router.post("/projects/{project_id}/images", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def add_project_image(
    project_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectOut:
    """Append an image to a project (first one becomes the cover)."""
    pr = _my_project(db, user, project_id)
    if len(pr.images) >= MAX_PROJECT_IMAGES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"At most {MAX_PROJECT_IMAGES} images per project.")
    data = await file.read()
    try:
        url = save_image(data, file.content_type, max_px=app_settings.DESIGN_MAX_PX)
    except StorageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    next_pos = max((i.position for i in pr.images), default=-1) + 1
    db.add(DesignerProjectImage(project_id=pr.id, image_url=url, position=next_pos))
    db.commit()
    db.refresh(pr)
    return _project_out(pr)


@router.delete("/projects/{project_id}/images/{image_id}", response_model=ProjectOut)
def delete_project_image(
    project_id: uuid.UUID,
    image_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectOut:
    """Remove an image. If the last image goes, the project is auto-unpublished
    (it can't be public without work to show)."""
    pr = _my_project(db, user, project_id)
    img = db.get(DesignerProjectImage, image_id)
    if img is None or img.project_id != pr.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found.")
    url = img.image_url
    db.delete(img)
    db.flush()
    remaining = [i for i in pr.images if i.id != image_id]
    # Compact positions so the cover stays position 0.
    for pos, i in enumerate(sorted(remaining, key=lambda x: x.position)):
        i.position = pos
    if not remaining:
        pr.published = False
    db.commit()
    db.refresh(pr)
    delete_image(url)
    return _project_out(pr)


@router.post("/projects/{project_id}/reorder", response_model=ProjectOut)
def reorder_project_images(
    project_id: uuid.UUID,
    payload: ReorderIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectOut:
    """Set image order (image_ids in the desired order). The first id becomes the
    cover. Ids not belonging to the project are ignored; omitted images sink to
    the end in their current order."""
    pr = _my_project(db, user, project_id)
    by_id = {i.id: i for i in pr.images}
    order = [iid for iid in payload.image_ids if iid in by_id]
    ranked = order + [i.id for i in sorted(pr.images, key=lambda x: x.position) if i.id not in order]
    for pos, iid in enumerate(ranked):
        by_id[iid].position = pos
    db.commit()
    db.refresh(pr)
    return _project_out(pr)


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
    country: str | None
    experience: str | None
    skills: list[str]
    portfolio_links: list[str]
    website: str | None
    behance: str | None
    dribbble: str | None
    instagram: str | None
    member_since: datetime
    rating_avg: float | None
    rating_count: int
    completed_jobs: int
    response_hours: float | None
    reviews: list[ReviewOut]
    projects: list[ProjectOut]
    portfolio: list[PortfolioPiece]


@public_router.get("/{slug}", response_model=DesignerPublicProfile)
def designer_profile(
    slug: str,
    db: Session = Depends(get_db),
) -> DesignerPublicProfile:
    """Public designer profile — no auth, so a shared link opens for anyone
    (sellers view it before hiring; guests can view it too)."""
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
    designs = db.scalars(
        select(Design).where(Design.owner_user_id == p.user_id).order_by(Design.created_at.desc()).limit(12)
    ).all()

    # Published projects only — featured first, then newest (drafts stay private).
    projects = [
        _project_out(pr)
        for pr in sorted(
            (x for x in p.projects if x.published),
            key=lambda x: (not x.featured, -x.created_at.timestamp()),
        )
    ]

    # Portfolio = the designer's uploaded showcase images first, then their Designs.
    portfolio = [
        PortfolioPiece(id=i.id, resource_url=i.image_url, source="portfolio", created_at=i.created_at)
        for i in p.portfolio_items
    ] + [
        PortfolioPiece(id=d.id, resource_url=d.resource_url, source=d.source.value, created_at=d.created_at)
        for d in designs
    ]

    return DesignerPublicProfile(
        id=p.id,
        slug=p.slug,
        display_name=p.display_name,
        bio=p.bio,
        avatar_url=p.avatar_url,
        cover_url=p.cover_url,
        country=p.country,
        experience=p.experience,
        skills=list(p.skills or []),
        portfolio_links=list(p.portfolio_links or []),
        website=p.website,
        behance=p.behance,
        dribbble=p.dribbble,
        instagram=p.instagram,
        member_since=p.created_at,
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
        projects=projects,
        portfolio=portfolio,
    )
