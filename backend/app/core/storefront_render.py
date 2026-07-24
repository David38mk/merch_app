"""How a storefront's products are laid out for buyers.

Shared by the public page and the seller's preview so that "preview" and "live"
can never disagree — a preview built from different code is a preview that lies.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.catalog import BaseItem
from app.models.design import Design
from app.models.enums import ShopItemState
from app.models.shop import ShopItem
from app.models.user import SellerProfile
from app.schemas.storefront import PublicProduct, PublicVariant

EMPTY_CURATION = {"order": [], "hidden": [], "featured": []}


def curated_products(db: Session, p: SellerProfile, curation: dict | None) -> list[PublicProduct]:
    """Listed products minus hidden, featured first, then the seller's saved order."""
    cur = curation or EMPTY_CURATION
    hidden = set(cur.get("hidden") or [])
    featured = set(cur.get("featured") or [])
    order = list(cur.get("order") or [])

    listed = db.scalars(
        select(ShopItem)
        .where(ShopItem.seller_profile_id == p.id, ShopItem.state == ShopItemState.LISTED)
        .order_by(ShopItem.created_at.desc())
        .options(
            selectinload(ShopItem.base_item).selectinload(BaseItem.variants),
            selectinload(ShopItem.base_item).selectinload(BaseItem.category),
        )
    ).all()

    products: list[PublicProduct] = []
    for it in listed:
        pid = str(it.id)
        if pid in hidden:
            continue
        design = db.get(Design, it.design_id) if it.design_id else None
        variants = [
            PublicVariant(color=v.color, size=v.size)
            for v in (it.base_item.variants if it.base_item else [])
            if v.is_available
        ]
        products.append(
            PublicProduct(
                id=pid,
                name=it.name,
                price=str(it.price),
                category=it.base_item.category.name if it.base_item and it.base_item.category else None,
                variants=variants,
                base_image_url=it.base_item.image_url if it.base_item else None,
                design_url=design.resource_url if design else None,
                pos_x=it.pos_x,
                pos_y=it.pos_y,
                scale=it.scale,
                rotation=it.rotation,
                featured=pid in featured,
            )
        )

    def sort_key(prod: PublicProduct) -> tuple[int, int]:
        rank = order.index(prod.id) if prod.id in order else len(order)
        return (0 if prod.featured else 1, rank)

    products.sort(key=sort_key)
    return products
