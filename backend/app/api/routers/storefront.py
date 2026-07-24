"""Website builder. Every edit writes to `storefront_draft`; the published columns
(and the public /store/{slug} page) only change when the seller hits Publish."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import require_role
from app.core.config import settings
from app.core.database import get_db
from app.core.slug import normalize_slug, slug_error, slug_taken, store_url, unique_slug
from app.core.storefront_render import curated_products
from app.models.design import Design
from app.models.enums import Role, ShopItemState, SocialPlatform, StoreState
from app.models.shop import ShopItem
from app.models.user import SellerProfile, SocialLink, User
from app.schemas.storefront import (
    DEFAULT_THEME,
    SOCIAL_PLATFORMS,
    BuilderProduct,
    CurationOut,
    PublicStorefront,
    PublishStatus,
    SlugCheck,
    SocialLinksPayload,
    StorefrontConfig,
    StorefrontDraftUpdate,
    StorefrontState,
    ThemeOut,
)
from app.seams.storage import StorageError, delete_image, save_image

router = APIRouter(prefix="/seller/storefront", tags=["storefront"])


# ── helpers ──────────────────────────────────────────────────────────────────

def _profile(db: Session, user: User) -> SellerProfile | None:
    return db.scalar(select(SellerProfile).where(SellerProfile.user_id == user.id))


def _ensure_profile(db: Session, user: User, lock: bool = False) -> SellerProfile:
    """`lock=True` takes a row lock for the transaction. Every draft mutation is a
    read-modify-write of one JSON column, so two concurrent requests (autosave +
    image upload happen together in a debounced UI) would otherwise each write
    the whole draft back and silently drop the other's change."""
    stmt = select(SellerProfile).where(SellerProfile.user_id == user.id)
    if lock:
        stmt = stmt.with_for_update()
    p = db.scalar(stmt)
    if p is None:
        p = SellerProfile(user_id=user.id)
        db.add(p)
        db.flush()
    return p


def _draft_file(p: SellerProfile, key: str) -> str | None:
    """A file referenced only by the draft (not published) — ours to clean up."""
    draft = p.storefront_draft or {}
    url = draft.get(key)
    published = p.avatar_url if key == "logo_url" else p.cover_url
    return url if url and url != published else None


def _published_socials(db: Session, user: User) -> dict[str, str]:
    rows = db.scalars(select(SocialLink).where(SocialLink.user_id == user.id)).all()
    return {sl.platform.value: sl.url for sl in rows if sl.platform in SOCIAL_PLATFORMS}


def _published_config(db: Session, user: User, p: SellerProfile) -> dict:
    """The live values — what the public storefront currently serves."""
    return {
        "brand_name": p.store_name,
        "creator_name": p.creator_name,
        "description": p.bio,
        "slug": p.slug,
        "logo_url": p.avatar_url,
        "cover_url": p.cover_url,
        "contact_email": p.contact_email,
        "location": p.location,
        "socials": _published_socials(db, user),
        "theme": {
            "primary": p.theme_primary or DEFAULT_THEME["primary"],
            "accent": p.theme_accent or DEFAULT_THEME["accent"],
            "button_style": p.button_style or DEFAULT_THEME["button_style"],
        },
        "curation": p.curation or {"order": [], "hidden": [], "featured": []},
    }


def _effective(db: Session, user: User, p: SellerProfile) -> dict:
    """Draft merged over published — what the builder shows and previews."""
    base = _published_config(db, user, p)
    draft = p.storefront_draft or {}
    merged = {**base, **{k: v for k, v in draft.items() if k not in ("theme", "curation", "socials")}}
    merged["theme"] = {**base["theme"], **(draft.get("theme") or {})}
    merged["curation"] = draft.get("curation") or base["curation"]
    merged["socials"] = draft["socials"] if "socials" in draft else base["socials"]
    return merged


def _config_out(cfg: dict) -> StorefrontConfig:
    return StorefrontConfig(
        brand_name=cfg.get("brand_name"),
        creator_name=cfg.get("creator_name"),
        description=cfg.get("description"),
        slug=cfg.get("slug"),
        logo_url=cfg.get("logo_url"),
        cover_url=cfg.get("cover_url"),
        contact_email=cfg.get("contact_email"),
        location=cfg.get("location"),
        socials={k: v for k, v in (cfg.get("socials") or {}).items() if v},
        theme=ThemeOut(**cfg["theme"]),
        curation=CurationOut(**(cfg.get("curation") or {})),
    )


def _builder_products(db: Session, p: SellerProfile) -> list[BuilderProduct]:
    rows = db.scalars(
        select(ShopItem)
        .where(ShopItem.seller_profile_id == p.id, ShopItem.state == ShopItemState.LISTED)
        .order_by(ShopItem.created_at.desc())
        .options(selectinload(ShopItem.base_item))
    ).all()
    out = []
    for it in rows:
        design = db.get(Design, it.design_id)
        out.append(
            BuilderProduct(
                id=str(it.id),
                name=it.name,
                price=str(it.price),
                base_image_url=it.base_item.image_url if it.base_item else None,
                design_url=design.resource_url if design else None,
                pos_x=it.pos_x,
                pos_y=it.pos_y,
                scale=it.scale,
                rotation=it.rotation,
            )
        )
    return out


def _status(p: SellerProfile) -> PublishStatus:
    """Derived from the two facts we already store — never a third column to sync.

    LIVE                        → PUBLISHED
    DRAFT + never published     → DRAFT
    DRAFT + published before    → UNPUBLISHED (seller took it down)
    """
    if p.store_state == StoreState.LIVE:
        return PublishStatus.PUBLISHED
    return PublishStatus.UNPUBLISHED if p.published_at else PublishStatus.DRAFT


def _check_slug(db: Session, p: SellerProfile | None, raw: str | None) -> SlugCheck | None:
    """Availability of the slug the seller is currently typing."""
    if raw is None:
        return None
    slug = normalize_slug(raw)
    err = slug_error(slug)
    if err:
        return SlugCheck(slug=slug, available=False, reason=err)
    if slug_taken(db, slug, exclude_id=p.id if p else None):
        return SlugCheck(
            slug=slug,
            available=False,
            reason="That store URL is already taken.",
            suggestion=unique_slug(db, slug, exclude_id=p.id if p else None),
        )
    return SlugCheck(slug=slug, available=True)


def _blockers(cfg: dict, check: SlugCheck | None) -> list[str]:
    """Everything standing between this draft and a live storefront."""
    out: list[str] = []
    if not (cfg.get("brand_name") or "").strip():
        out.append("Add a brand name.")
    if check is not None and not check.available:
        out.append(check.reason or "Fix your store URL.")
    return out


def _state(db: Session, user: User, p: SellerProfile | None) -> StorefrontState:
    if p is None:
        empty = {
            "socials": {},
            "theme": dict(DEFAULT_THEME),
            "curation": {"order": [], "hidden": [], "featured": []},
        }
        return StorefrontState(
            config=_config_out(empty),
            has_unpublished_changes=False,
            blockers=["Add a brand name."],
        )

    cfg = _effective(db, user, p)
    # Only validate a slug the seller actually typed; an untouched blank one is
    # auto-generated from the brand name at publish time.
    raw_slug = cfg.get("slug")
    check = _check_slug(db, p, raw_slug) if (raw_slug or "").strip() else None
    pending = check.slug if check else p.slug

    return StorefrontState(
        config=_config_out(cfg),
        has_unpublished_changes=bool(p.storefront_draft),
        store_state=p.store_state,
        is_published=p.store_state == StoreState.LIVE,
        published_at=p.published_at.isoformat() if p.published_at else None,
        products=_builder_products(db, p),
        status=_status(p),
        # The live URL only exists once published — it points at p.slug, not the draft's.
        store_url=store_url(p.slug) if p.store_state == StoreState.LIVE else None,
        pending_slug=pending,
        slug_check=check,
        last_published_at=p.last_published_at.isoformat() if p.last_published_at else None,
        version=p.storefront_version,
        blockers=_blockers(cfg, check),
    )


def _prune_draft(db: Session, user: User, p: SellerProfile) -> None:
    """Drop draft keys whose value already equals the published one. Keeps
    'unpublished changes' honest: an autosave that lands just after a publish
    (or an edit typed and then reverted) leaves no phantom draft behind."""
    draft = dict(p.storefront_draft or {})
    if not draft:
        return
    base = _published_config(db, user, p)

    def same(a, b) -> bool:
        return (a or "") == (b or "")

    for k in ("brand_name", "creator_name", "description", "slug",
              "contact_email", "location", "logo_url", "cover_url"):
        if k in draft and same(draft[k], base.get(k)):
            draft.pop(k)
    if "theme" in draft:
        diff = {k: v for k, v in (draft["theme"] or {}).items() if v and v != base["theme"].get(k)}
        if diff:
            draft["theme"] = diff
        else:
            draft.pop("theme")
    if "curation" in draft and draft["curation"] == base["curation"]:
        draft.pop("curation")
    if "socials" in draft:
        cleaned = {k: v for k, v in (draft["socials"] or {}).items() if v}
        if cleaned == base["socials"]:
            draft.pop("socials")
    p.storefront_draft = draft or None


def _merge_draft(p: SellerProfile, patch: dict) -> None:
    """Shallow-merge a partial update into the draft (nested dicts merge one level)."""
    draft = dict(p.storefront_draft or {})
    for key, value in patch.items():
        if key in ("theme",) and isinstance(value, dict):
            draft[key] = {**(draft.get(key) or {}), **value}
        else:
            draft[key] = value
    p.storefront_draft = draft


# ── read / autosave ──────────────────────────────────────────────────────────

@router.get("", response_model=StorefrontState)
def get_storefront(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> StorefrontState:
    return _state(db, user, _profile(db, user))


@router.patch("", response_model=StorefrontState)
def save_draft(
    payload: StorefrontDraftUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> StorefrontState:
    """Autosave. Writes ONLY to the draft — the live storefront is untouched."""
    p = _ensure_profile(db, user, lock=True)
    patch = payload.model_dump(exclude_unset=True, exclude_none=False)

    clean: dict = {}
    for key, value in patch.items():
        if value is None:
            continue
        if key in ("brand_name", "creator_name", "description", "contact_email", "location", "slug"):
            clean[key] = value.strip() if isinstance(value, str) else value
        elif key == "socials":
            clean["socials"] = {k: v for k, v in value.items() if v}
        elif key == "theme":
            clean["theme"] = {k: v for k, v in value.items() if v}
        elif key == "curation":
            clean["curation"] = value

    _merge_draft(p, clean)
    _prune_draft(db, user, p)
    db.commit()
    db.refresh(p)
    return _state(db, user, p)


@router.get("/slug-check", response_model=SlugCheck)
def check_slug(
    slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> SlugCheck:
    """Is this store URL free? Called as the seller types, before they publish."""
    return _check_slug(db, _profile(db, user), slug) or SlugCheck(
        slug="", available=False, reason="Choose a store URL."
    )


@router.get("/preview", response_model=PublicStorefront)
def preview_storefront(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> PublicStorefront:
    """The DRAFT rendered exactly as buyers would see it, for the pre-publish preview.

    Built through the same renderer as the public page, so preview can't drift
    from what publishing would actually ship.
    """
    p = _ensure_profile(db, user)
    cfg = _effective(db, user, p)
    return PublicStorefront(
        brand_name=(cfg.get("brand_name") or "").strip() or "Untitled store",
        creator_name=cfg.get("creator_name"),
        description=cfg.get("description"),
        slug=(cfg.get("slug") and normalize_slug(cfg["slug"])) or p.slug or "",
        logo_url=cfg.get("logo_url"),
        cover_url=cfg.get("cover_url"),
        contact_email=cfg.get("contact_email"),
        location=cfg.get("location"),
        socials={k: v for k, v in (cfg.get("socials") or {}).items() if v},
        theme=ThemeOut(**cfg["theme"]),
        products=curated_products(db, p, cfg.get("curation")),
    )


@router.post("/discard", response_model=StorefrontState)
def discard_draft(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> StorefrontState:
    """Throw away unpublished edits and fall back to the live version."""
    p = _ensure_profile(db, user, lock=True)
    # Files uploaded into the discarded draft are unreferenced from here on.
    orphans = [f for f in (_draft_file(p, "logo_url"), _draft_file(p, "cover_url")) if f]
    p.storefront_draft = None
    db.commit()
    for f in orphans:
        delete_image(f)
    db.refresh(p)
    return _state(db, user, p)


# ── image uploads (write into the draft) ─────────────────────────────────────

async def _store(file: UploadFile, max_px: int) -> str:
    data = await file.read()
    try:
        return save_image(data, file.content_type, max_px=max_px)
    except StorageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


async def _swap_draft_image(
    db: Session, user: User, key: str, file: UploadFile, max_px: int
) -> StorefrontState:
    """Store the new file, point the draft at it, and clean up the file the draft
    was pointing at before (if it was draft-only) — re-uploading must not leak."""
    url = await _store(file, max_px)
    p = _ensure_profile(db, user, lock=True)
    old = _draft_file(p, key)
    _merge_draft(p, {key: url})
    _prune_draft(db, user, p)
    db.commit()
    if old:
        delete_image(old)
    db.refresh(p)
    return _state(db, user, p)


def _clear_draft_image(db: Session, user: User, key: str) -> StorefrontState:
    p = _ensure_profile(db, user, lock=True)
    old = _draft_file(p, key)
    _merge_draft(p, {key: ""})
    _prune_draft(db, user, p)
    db.commit()
    if old:
        delete_image(old)
    db.refresh(p)
    return _state(db, user, p)


@router.post("/logo", response_model=StorefrontState)
async def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> StorefrontState:
    return await _swap_draft_image(db, user, "logo_url", file, settings.LOGO_MAX_PX)


@router.post("/cover", response_model=StorefrontState)
async def upload_cover(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> StorefrontState:
    return await _swap_draft_image(db, user, "cover_url", file, settings.COVER_MAX_PX)


@router.delete("/logo", response_model=StorefrontState)
def remove_logo(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> StorefrontState:
    return _clear_draft_image(db, user, "logo_url")


@router.delete("/cover", response_model=StorefrontState)
def remove_cover(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> StorefrontState:
    return _clear_draft_image(db, user, "cover_url")


# ── publish ──────────────────────────────────────────────────────────────────

def _apply_socials(db: Session, user: User, socials: dict) -> None:
    payload = SocialLinksPayload(**{k.lower(): v for k, v in socials.items()})
    desired = payload.as_map()
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


@router.post("/publish", response_model=StorefrontState)
def publish_storefront(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> StorefrontState:
    """Apply the draft to the published columns and take the store live."""
    p = _ensure_profile(db, user, lock=True)
    cfg = _effective(db, user, p)

    if not (cfg.get("brand_name") or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Add a brand name before publishing your storefront.",
        )

    # brand identity
    old_logo, old_cover = p.avatar_url, p.cover_url
    p.store_name = cfg["brand_name"].strip()
    p.creator_name = (cfg.get("creator_name") or "").strip() or None
    p.bio = (cfg.get("description") or "").strip() or None
    p.avatar_url = cfg.get("logo_url") or None
    p.cover_url = cfg.get("cover_url") or None
    p.contact_email = (cfg.get("contact_email") or "").strip() or None
    p.location = (cfg.get("location") or "").strip() or None
    # Replaced files are deleted only AFTER a successful commit — if validation
    # or the commit fails below, the still-live store must keep its images.
    orphans = [
        old for old, new in ((old_logo, p.avatar_url), (old_cover, p.cover_url)) if old and old != new
    ]

    # store URL — a typed slug must be valid and free; a blank one is derived
    # from the brand name. We never silently hand out a different slug than the
    # seller asked for: they'd publish and share the wrong link.
    desired_slug = (cfg.get("slug") or "").strip()
    if desired_slug:
        check = _check_slug(db, p, desired_slug)
        if check is None or not check.available:
            detail = check.reason if check else "Choose a store URL."
            if check and check.suggestion:
                detail = f"{detail} Try “{check.suggestion}”."
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
        p.slug = check.slug
    elif not p.slug:
        p.slug = unique_slug(db, p.store_name, exclude_id=p.id)

    # theme + curation + socials
    theme = cfg["theme"]
    p.theme_primary, p.theme_accent, p.button_style = (
        theme["primary"],
        theme["accent"],
        theme["button_style"],
    )
    p.curation = cfg.get("curation") or {"order": [], "hidden": [], "featured": []}
    _apply_socials(db, user, cfg.get("socials") or {})

    now = datetime.now(timezone.utc)
    p.store_state = StoreState.LIVE
    if p.published_at is None:
        p.published_at = now  # first publish ever — also what makes DRAFT ≠ UNPUBLISHED
    p.last_published_at = now
    p.storefront_version += 1  # busts the public page's ETag
    p.storefront_draft = None  # draft consumed

    try:
        db.commit()
    except IntegrityError:
        # Two publishes raced the same slug past _check_slug; the unique index
        # kept the data safe — turn the raw 500 into the same friendly error.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That store URL was just taken. Pick another one and publish again.",
        )
    for f in orphans:
        delete_image(f)
    db.refresh(p)
    return _state(db, user, p)


@router.post("/unpublish", response_model=StorefrontState)
def unpublish_storefront(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> StorefrontState:
    """Take the storefront offline. Published values are kept, so republishing
    restores exactly what was live — the status becomes UNPUBLISHED, not DRAFT."""
    p = _ensure_profile(db, user, lock=True)
    p.store_state = StoreState.DRAFT
    p.storefront_version += 1  # caches must stop serving the removed page
    db.commit()
    db.refresh(p)
    return _state(db, user, p)
