"""Buyer wishlist — saved products, persisted per account so the list follows
the buyer across devices. Guests keep a local list (frontend) that merges in on
login via /merge. The wishlist stores product ids only; the cards (with live
availability) are rendered from the public `/marketplace/wishlist-cards`
endpoint, so guests and logged-in buyers share one card-builder."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.database import get_db
from app.models.commerce import WishlistItem
from app.models.enums import Role
from app.models.shop import ShopItem
from app.models.user import User

router = APIRouter(prefix="/buyer/wishlist", tags=["wishlist"])


class WishlistIds(BaseModel):
    ids: list[uuid.UUID]


class WishlistAddIn(BaseModel):
    shop_item_id: uuid.UUID


def _ids(db: Session, user: User) -> list[uuid.UUID]:
    return list(
        db.scalars(
            select(WishlistItem.shop_item_id)
            .where(WishlistItem.buyer_user_id == user.id)
            .order_by(WishlistItem.created_at.desc())
        ).all()
    )


@router.get("", response_model=WishlistIds)
def get_wishlist(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.BUYER)),
) -> WishlistIds:
    return WishlistIds(ids=_ids(db, user))


@router.post("", response_model=WishlistIds)
def add_to_wishlist(
    payload: WishlistAddIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.BUYER)),
) -> WishlistIds:
    """Idempotent — saving an already-saved product is a no-op."""
    if db.get(ShopItem, payload.shop_item_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
    exists = db.scalar(
        select(WishlistItem).where(
            WishlistItem.buyer_user_id == user.id, WishlistItem.shop_item_id == payload.shop_item_id
        )
    )
    if exists is None:
        db.add(WishlistItem(buyer_user_id=user.id, shop_item_id=payload.shop_item_id))
        db.commit()
    return WishlistIds(ids=_ids(db, user))


@router.delete("/{shop_item_id}", response_model=WishlistIds)
def remove_from_wishlist(
    shop_item_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.BUYER)),
) -> WishlistIds:
    row = db.scalar(
        select(WishlistItem).where(
            WishlistItem.buyer_user_id == user.id, WishlistItem.shop_item_id == shop_item_id
        )
    )
    if row is not None:
        db.delete(row)
        db.commit()
    return WishlistIds(ids=_ids(db, user))


@router.post("/merge", response_model=WishlistIds)
def merge_wishlist(
    payload: WishlistIds,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.BUYER)),
) -> WishlistIds:
    """Union a guest's local wishlist into the server one on login."""
    have = set(_ids(db, user))
    changed = False
    for sid in payload.ids:
        if sid not in have and db.get(ShopItem, sid) is not None:
            db.add(WishlistItem(buyer_user_id=user.id, shop_item_id=sid))
            have.add(sid)
            changed = True
    if changed:
        db.commit()
    return WishlistIds(ids=_ids(db, user))
