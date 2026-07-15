from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.enums import StoreState
from app.models.user import SellerProfile, SocialLink
from app.schemas.storefront import SOCIAL_PLATFORMS, PublicStorefront

# Public (no auth) — the buyer-facing storefront a customer visits at /store/{slug}.
router = APIRouter(prefix="/store", tags=["storefront-public"])


@router.get("/{slug}", response_model=PublicStorefront)
def get_public_storefront(slug: str, db: Session = Depends(get_db)) -> PublicStorefront:
    p = db.scalar(select(SellerProfile).where(SellerProfile.slug == slug))
    # Only LIVE storefronts are visible; drafts 404 like any unknown slug.
    if p is None or p.store_state != StoreState.LIVE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storefront not found.")

    rows = db.scalars(select(SocialLink).where(SocialLink.user_id == p.user_id)).all()
    socials = {sl.platform.value: sl.url for sl in rows if sl.platform in SOCIAL_PLATFORMS}

    return PublicStorefront(
        brand_name=p.store_name or "Untitled store",
        creator_name=p.creator_name,
        description=p.bio,
        slug=p.slug,
        logo_url=p.avatar_url,
        cover_url=p.cover_url,
        socials=socials,
        products=[],  # products/cart/checkout ship in a later goal
    )
