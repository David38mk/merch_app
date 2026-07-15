from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.config import settings
from app.core.database import get_db
from app.core.slug import unique_slug
from app.models.enums import Role, SocialPlatform, StoreState
from app.models.user import SellerProfile, SocialLink, User
from app.schemas.storefront import (
    SOCIAL_PLATFORMS,
    SocialLinksPayload,
    StorefrontState,
    StorefrontUpdate,
)
from app.seams.storage import StorageError, delete_image, save_image

router = APIRouter(prefix="/seller/storefront", tags=["storefront"])


# ── helpers ──────────────────────────────────────────────────────────────────

def _profile(db: Session, user: User) -> SellerProfile | None:
    return db.scalar(select(SellerProfile).where(SellerProfile.user_id == user.id))


def _ensure_profile(db: Session, user: User) -> SellerProfile:
    p = _profile(db, user)
    if p is None:
        p = SellerProfile(user_id=user.id)
        db.add(p)
    return p


def _socials_map(db: Session, user: User) -> dict[str, str]:
    """The user's storefront social links (excludes non-editor platforms like X)."""
    rows = db.scalars(select(SocialLink).where(SocialLink.user_id == user.id)).all()
    return {sl.platform.value: sl.url for sl in rows if sl.platform in SOCIAL_PLATFORMS}


def _apply_socials(db: Session, user: User, payload: SocialLinksPayload) -> None:
    """Reconcile the 5 storefront platforms to exactly what the payload holds.
    Leaves any non-editor links (X/OTHER) untouched."""
    desired = payload.as_map()  # {SocialPlatform: url}
    existing = {
        sl.platform: sl
        for sl in db.scalars(select(SocialLink).where(SocialLink.user_id == user.id)).all()
        if sl.platform in SOCIAL_PLATFORMS
    }
    for platform, url in desired.items():
        row = existing.get(platform)
        if row is not None:
            row.url = url
        else:
            db.add(SocialLink(user_id=user.id, platform=platform, url=url))
    for platform, row in existing.items():
        if platform not in desired:
            db.delete(row)


def _apply(db: Session, p: SellerProfile, user: User, payload: StorefrontUpdate) -> None:
    if payload.brand_name is not None:
        p.store_name = payload.brand_name.strip() or None
    if payload.creator_name is not None:
        p.creator_name = payload.creator_name.strip() or None
    if payload.description is not None:
        p.bio = payload.description.strip() or None

    if payload.slug is not None and payload.slug.strip():
        # Explicit custom store URL — slugified + made unique.
        p.slug = unique_slug(db, payload.slug.strip(), exclude_id=p.id)
    elif payload.brand_name is not None and not p.slug and p.store_name:
        # First time we have a name and no URL yet → derive one. We never silently
        # change an existing slug on rename (it would break shared links).
        p.slug = unique_slug(db, p.store_name, exclude_id=p.id)

    if payload.socials is not None:
        _apply_socials(db, user, payload.socials)


def _state(db: Session, user: User, p: SellerProfile | None) -> StorefrontState:
    if p is None:
        return StorefrontState(socials=_socials_map(db, user))
    return StorefrontState(
        brand_name=p.store_name,
        creator_name=p.creator_name,
        description=p.bio,
        slug=p.slug,
        logo_url=p.avatar_url,
        cover_url=p.cover_url,
        socials=_socials_map(db, user),
        store_state=p.store_state,
        is_published=p.store_state == StoreState.LIVE,
        published_at=p.published_at.isoformat() if p.published_at else None,
    )


# ── read / edit ──────────────────────────────────────────────────────────────

@router.get("", response_model=StorefrontState)
def get_storefront(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> StorefrontState:
    return _state(db, user, _profile(db, user))


@router.patch("", response_model=StorefrontState)
def update_storefront(
    payload: StorefrontUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> StorefrontState:
    """Save draft edits (partial). Publishing state is unchanged — editing a LIVE
    store updates it in place (single-record model)."""
    p = _ensure_profile(db, user)
    _apply(db, p, user, payload)
    db.commit()
    db.refresh(p)
    return _state(db, user, p)


# ── image uploads (🔌 storage seam) ────────────────────────────────────────────

async def _read_and_store(file: UploadFile, max_px: int) -> str:
    data = await file.read()
    try:
        return save_image(data, file.content_type, max_px=max_px)
    except StorageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/logo", response_model=StorefrontState)
async def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> StorefrontState:
    url = await _read_and_store(file, settings.LOGO_MAX_PX)
    p = _ensure_profile(db, user)
    delete_image(p.avatar_url)  # drop the previous file
    p.avatar_url = url
    db.commit()
    db.refresh(p)
    return _state(db, user, p)


@router.post("/cover", response_model=StorefrontState)
async def upload_cover(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> StorefrontState:
    url = await _read_and_store(file, settings.COVER_MAX_PX)
    p = _ensure_profile(db, user)
    delete_image(p.cover_url)
    p.cover_url = url
    db.commit()
    db.refresh(p)
    return _state(db, user, p)


@router.delete("/logo", response_model=StorefrontState)
def remove_logo(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> StorefrontState:
    p = _ensure_profile(db, user)
    delete_image(p.avatar_url)
    p.avatar_url = None
    db.commit()
    db.refresh(p)
    return _state(db, user, p)


@router.delete("/cover", response_model=StorefrontState)
def remove_cover(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> StorefrontState:
    p = _ensure_profile(db, user)
    delete_image(p.cover_url)
    p.cover_url = None
    db.commit()
    db.refresh(p)
    return _state(db, user, p)


# ── publish / unpublish ────────────────────────────────────────────────────────

@router.post("/publish", response_model=StorefrontState)
def publish_storefront(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> StorefrontState:
    p = _ensure_profile(db, user)
    if not p.store_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Add a brand name before publishing your storefront.",
        )
    if not p.slug:
        p.slug = unique_slug(db, p.store_name, exclude_id=p.id)
    p.store_state = StoreState.LIVE
    if p.published_at is None:
        p.published_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(p)
    return _state(db, user, p)


@router.post("/unpublish", response_model=StorefrontState)
def unpublish_storefront(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> StorefrontState:
    """Take the storefront offline again (back to Draft). Keeps published_at history."""
    p = _ensure_profile(db, user)
    p.store_state = StoreState.DRAFT
    db.commit()
    db.refresh(p)
    return _state(db, user, p)
