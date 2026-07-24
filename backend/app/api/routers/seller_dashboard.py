from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.database import get_db
from app.models.enums import Role, ShopItemState, StoreState
from app.models.shop import ShopItem
from app.models.user import SellerProfile, User
from app.schemas.dashboard import (
    ChecklistFlags,
    DashboardStats,
    SellerDashboard,
    StorefrontMini,
)

router = APIRouter(prefix="/seller/dashboard", tags=["dashboard"])


@router.get("", response_model=SellerDashboard)
def get_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> SellerDashboard:
    """One aggregated payload for the seller home: onboarding checklist derived from
    real state, plus lightweight stats. Single round-trip so the dashboard loads fast."""
    p = db.scalar(select(SellerProfile).where(SellerProfile.user_id == user.id))

    product_count = 0
    live_count = 0
    if p is not None:
        product_count = db.scalar(
            select(func.count(ShopItem.id)).where(ShopItem.seller_profile_id == p.id)
        ) or 0
        live_count = db.scalar(
            select(func.count(ShopItem.id)).where(
                ShopItem.seller_profile_id == p.id, ShopItem.state == ShopItemState.LISTED
            )
        ) or 0

    # A logo counts whether it's published (avatar_url) or still sitting in the
    # website-builder draft — the checklist asks "did you upload one", not
    # "did you publish the whole storefront yet".
    draft = (p.storefront_draft or {}) if p else {}
    has_logo = bool(p and (p.avatar_url or draft.get("logo_url")))

    checklist = ChecklistFlags(
        complete_profile=bool(p and p.onboarding_completed),
        upload_logo=has_logo,
        create_product=product_count > 0,
        publish_product=live_count > 0,
        publish_store=bool(p and p.store_state == StoreState.LIVE),
    )
    flags = [
        checklist.complete_profile,
        checklist.upload_logo,
        checklist.create_product,
        checklist.publish_product,
        checklist.publish_store,
    ]
    steps_done = sum(flags)
    steps_total = len(flags)

    return SellerDashboard(
        first_name=(user.first_name or user.display_name or "there").split(" ")[0] or "there",
        display_name=user.display_name,
        checklist=checklist,
        steps_done=steps_done,
        steps_total=steps_total,
        is_active=steps_done == steps_total,
        storefront=StorefrontMini(
            is_published=bool(p and p.store_state == StoreState.LIVE),
            slug=p.slug if p else None,
            store_name=p.store_name if p else None,
            has_logo=has_logo,
        ),
        stats=DashboardStats(
            products=product_count,
            live_products=live_count,
            orders=0,  # commerce ships later
            ai_credits=p.ai_credits_balance if p else 0,
            currency=p.currency if p else None,
        ),
    )
