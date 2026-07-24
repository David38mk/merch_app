"""Server-persisted cart for logged-in buyers (Cart/CartItem, per-seller). Guests
keep a localStorage cart; on login the client merges it here so it follows them
across devices. The cart is self-cleaning: lines whose product got unlisted or
whose variant went out of stock are dropped on read/write."""

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.catalog import BaseItem, BaseItemVariant
from app.models.commerce import Cart, CartItem
from app.models.design import Design
from app.models.enums import ShopItemState, StoreState
from app.models.shop import ShopItem
from app.models.user import SellerProfile, User

router = APIRouter(prefix="/cart", tags=["cart"])


class CartLineIn(BaseModel):
    shop_item_id: uuid.UUID
    color: str
    size: str
    quantity: int = Field(default=1, ge=1, le=50)


class CartPayload(BaseModel):
    items: list[CartLineIn] = []


class CartLineOut(BaseModel):
    shop_item_id: str
    name: str
    price: str
    color: str
    size: str
    quantity: int
    brand_slug: str
    brand_name: str
    base_image_url: str | None
    design_url: str | None
    pos_x: float
    pos_y: float
    scale: float
    rotation: float


def _resolve(db: Session, line: CartLineIn):
    """Return (shop, seller, variant) if the line is still buyable, else None."""
    shop = db.get(ShopItem, line.shop_item_id)
    if shop is None or shop.state != ShopItemState.LISTED:
        return None
    seller = db.get(SellerProfile, shop.seller_profile_id)
    if seller is None or seller.store_state != StoreState.LIVE:
        return None
    variant = db.scalar(
        select(BaseItemVariant).where(
            BaseItemVariant.base_item_id == shop.base_item_id,
            BaseItemVariant.color == line.color,
            BaseItemVariant.size == line.size,
            BaseItemVariant.is_available.is_(True),
        )
    )
    if variant is None:
        return None
    return shop, seller, variant


def _line_out(db: Session, shop: ShopItem, seller: SellerProfile, variant: BaseItemVariant, qty: int) -> CartLineOut:
    base = db.get(BaseItem, shop.base_item_id)
    design = db.get(Design, shop.design_id) if shop.design_id else None
    return CartLineOut(
        shop_item_id=str(shop.id),
        name=shop.name,
        price=str(shop.price),
        color=variant.color,
        size=variant.size,
        quantity=qty,
        brand_slug=seller.slug or "",
        brand_name=seller.store_name or "Untitled store",
        base_image_url=base.image_url if base else None,
        design_url=design.resource_url if design else None,
        pos_x=shop.pos_x, pos_y=shop.pos_y, scale=shop.scale, rotation=shop.rotation,
    )


def _read(db: Session, user: User) -> list[CartLineOut]:
    carts = db.scalars(
        select(Cart).where(Cart.buyer_user_id == user.id).options(selectinload(Cart.items))
    ).all()
    out: list[CartLineOut] = []
    for cart in carts:
        for ci in cart.items:
            shop = db.get(ShopItem, ci.shop_item_id)
            variant = db.get(BaseItemVariant, ci.base_item_variant_id)
            seller = db.get(SellerProfile, cart.seller_profile_id)
            if shop is None or variant is None or seller is None:
                continue
            if shop.state != ShopItemState.LISTED or seller.store_state != StoreState.LIVE:
                continue
            out.append(_line_out(db, shop, seller, variant, ci.quantity))
    return out


def _write(db: Session, user: User, lines: list[CartLineIn]) -> list[CartLineOut]:
    """Replace the buyer's whole cart with `lines` (deduped, validated)."""
    # Collapse duplicate (product, variant) lines, summing quantities.
    collapsed: dict[tuple, int] = {}
    for ln in lines:
        key = (ln.shop_item_id, ln.color, ln.size)
        collapsed[key] = min(50, collapsed.get(key, 0) + ln.quantity)

    for cart in db.scalars(select(Cart).where(Cart.buyer_user_id == user.id)).all():
        db.delete(cart)  # cascade removes its items
    db.flush()

    carts: dict[uuid.UUID, Cart] = {}
    for (sid, color, size), qty in collapsed.items():
        r = _resolve(db, CartLineIn(shop_item_id=sid, color=color, size=size, quantity=qty))
        if r is None:
            continue  # silently drop no-longer-buyable lines
        shop, seller, variant = r
        cart = carts.get(seller.id)
        if cart is None:
            cart = Cart(buyer_user_id=user.id, seller_profile_id=seller.id)
            db.add(cart)
            db.flush()
            carts[seller.id] = cart
        db.add(CartItem(cart_id=cart.id, shop_item_id=shop.id, base_item_variant_id=variant.id, quantity=qty))
    db.commit()
    return _read(db, user)


@router.get("", response_model=list[CartLineOut])
def get_cart(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[CartLineOut]:
    return _read(db, user)


@router.put("", response_model=list[CartLineOut])
def replace_cart(
    payload: CartPayload, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[CartLineOut]:
    return _write(db, user, payload.items)


@router.post("/merge", response_model=list[CartLineOut])
def merge_cart(
    payload: CartPayload, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[CartLineOut]:
    """Add the given lines (a guest's local cart) to whatever's already stored."""
    existing = [
        CartLineIn(shop_item_id=uuid.UUID(l.shop_item_id), color=l.color, size=l.size, quantity=l.quantity)
        for l in _read(db, user)
    ]
    return _write(db, user, existing + payload.items)
