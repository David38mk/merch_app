import hashlib
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.storefront_render import curated_products
from app.models.commerce import StoreVisit
from app.models.enums import ShopItemState, StoreState
from app.models.shop import ShopItem
from app.models.user import SellerProfile, SocialLink
from app.schemas.storefront import (
    DEFAULT_THEME,
    SOCIAL_PLATFORMS,
    PublicStorefront,
    ThemeOut,
)

# Public (no auth) — the buyer-facing storefront a customer visits at /store/{slug}.
# Serves PUBLISHED values only; a seller's unsaved draft is never visible here.
router = APIRouter(prefix="/store", tags=["storefront-public"])


def _etag(db: Session, p: SellerProfile) -> str:
    """Changes when anything the page serves changes: storefront publishes bump
    the version, and the products fingerprint moves when items are listed,
    edited, archived or deleted — otherwise revalidating browsers would get 304s
    over a stale product grid until the seller happened to republish."""
    count, latest = db.execute(
        select(func.count(), func.max(ShopItem.updated_at)).where(
            ShopItem.seller_profile_id == p.id, ShopItem.state == ShopItemState.LISTED
        )
    ).one()
    # Microsecond precision — a whole-second stamp misses an edit made in the
    # same second as the previous one and serves a stale 304.
    stamp = int(latest.timestamp() * 1_000_000) if latest else 0
    return f'W/"{p.slug}-v{p.storefront_version}-{count}-{stamp}"'


def _record_visit(db: Session, request: Request, seller_id) -> None:
    """One row per unique visitor per day. IP is stored only as a salted hash —
    enough to dedup, useless to identify anyone. ON CONFLICT keeps repeat views
    free and race-safe. A 304 revalidation still counts: same person, same day."""
    ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(f"mhc-visit:{ip}".encode()).hexdigest()[:32]
    db.execute(
        pg_insert(StoreVisit)
        .values(seller_profile_id=seller_id, day=date.today(), ip_hash=ip_hash)
        .on_conflict_do_nothing(constraint="uq_visit")
    )
    db.commit()


def _etag_matches(if_none_match: str | None, etag: str) -> bool:
    """RFC 9110 weak comparison: '*' matches anything, lists are split, and the
    W/ prefix is ignored on both sides (proxies sometimes strip it)."""
    if not if_none_match:
        return False
    if if_none_match.strip() == "*":
        return True
    def core(tag: str) -> str:
        tag = tag.strip()
        return tag[2:] if tag.startswith("W/") else tag
    return any(core(candidate) == core(etag) for candidate in if_none_match.split(","))


@router.get("/{slug}", response_model=PublicStorefront)
def get_public_storefront(
    slug: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> PublicStorefront:
    p = db.scalar(select(SellerProfile).where(SellerProfile.slug == slug))
    # Only LIVE storefronts are visible; drafts and unpublished stores 404 like
    # any unknown slug — a taken-down store shouldn't leak that it ever existed.
    if p is None or p.store_state != StoreState.LIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storefront not found.")

    _record_visit(db, request, p.id)

    # Short max-age keeps the page fast; the version-stamped ETag means a republish
    # is picked up on the very next revalidation instead of waiting out a TTL.
    etag = _etag(db, p)
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = (
        f"public, max-age={settings.STOREFRONT_CACHE_SECONDS}, must-revalidate"
    )
    if _etag_matches(request.headers.get("if-none-match"), etag):
        # Returning a Response directly bypasses response_model — 304 must have no body.
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=dict(response.headers))

    rows = db.scalars(select(SocialLink).where(SocialLink.user_id == p.user_id)).all()
    socials = {sl.platform.value: sl.url for sl in rows if sl.platform in SOCIAL_PLATFORMS}

    return PublicStorefront(
        brand_name=p.store_name or "Untitled store",
        creator_name=p.creator_name,
        description=p.bio,
        slug=p.slug,
        logo_url=p.avatar_url,
        cover_url=p.cover_url,
        contact_email=p.contact_email,
        location=p.location,
        socials=socials,
        theme=ThemeOut(
            primary=p.theme_primary or DEFAULT_THEME["primary"],
            accent=p.theme_accent or DEFAULT_THEME["accent"],
            button_style=p.button_style or DEFAULT_THEME["button_style"],
        ),
        products=curated_products(db, p, p.curation),
    )
