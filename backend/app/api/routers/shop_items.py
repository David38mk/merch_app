"""Seller products (ShopItem): create a finished product from a blank + design,
list/manage them, and expose pricing info for the profit calculator."""

import uuid
from datetime import date, datetime, time
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import require_role
from app.core.database import get_db
from app.core.pricing import commission_rate, min_price
from app.models.catalog import BaseItem, ItemCategory, PrintArea
from app.models.design import Design
from app.models.enums import PlanCode, PrintOptionKind, Role, ShopItemState
from app.models.hiring import Collaboration
from app.models.shop import ShopItem, ShopItemRevision
from app.models.user import SellerProfile, User
from app.seams.ai import generate_product_copy
from app.seams.mockups import generate_mockups
from app.seams.search import index_product

router = APIRouter(prefix="/shop-items", tags=["shop-items"])


# ── schemas ────────────────────────────────────────────────────────────────────

class ShopItemCreate(BaseModel):
    base_item_id: uuid.UUID
    design_id: uuid.UUID
    print_area: str | None = None
    pos_x: float = 50
    pos_y: float = 50
    scale: float = 0.45
    rotation: float = 0
    name: str = Field(min_length=1)
    description: str | None = None
    tags: list[str] = []
    price: Decimal
    # Selected variant/options — used to recompute the production cost server-side.
    color: str | None = None
    size: str | None = None
    material: str | None = None
    print_type: str | None = None
    publish: bool = False


class ShopItemPatch(BaseModel):
    """Every editable facet of a product. Only the keys sent are touched, so the
    edit page can save copy, variant and design independently or all at once."""

    name: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    price: Decimal | None = None
    state: ShopItemState | None = None
    # Variant + print options — changing any of these re-derives production_cost.
    color: str | None = None
    size: str | None = None
    material: str | None = None
    print_type: str | None = None
    # Design + placement, as returned by the design editor.
    design_id: uuid.UUID | None = None
    print_area: str | None = None
    pos_x: float | None = None
    pos_y: float | None = None
    scale: float | None = None
    rotation: float | None = None


class RevisionOut(BaseModel):
    id: uuid.UUID
    summary: list[str]
    created_at: datetime


class ShopItemOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    tags: list[str]
    price: Decimal
    production_cost: Decimal
    platform_fee: Decimal
    earnings: Decimal
    state: ShopItemState
    base_item_id: uuid.UUID
    base_name: str
    base_image_url: str | None
    design_id: uuid.UUID | None
    design_url: str | None
    provider: str | None
    category: str | None
    pos_x: float
    pos_y: float
    scale: float
    rotation: float
    created_at: datetime
    updated_at: datetime
    # Set when the product came out of a collaboration — lets the card link back.
    collaboration_id: uuid.UUID | None = None
    color: str | None = None
    size: str | None = None
    material: str | None = None
    print_type: str | None = None
    print_area: str | None = None
    # Lowest price that still covers production + the platform fee, so the editor
    # can validate before the seller hits Save.
    min_price: Decimal = Decimal("0")


class ProductCounts(BaseModel):
    """Per-tab totals, always over the seller's whole catalogue so the badges
    stay meaningful while a search or filter is narrowing the grid."""

    UNLISTED: int = 0
    LISTED: int = 0
    ARCHIVED: int = 0
    PENDING: int = 0


class ProductList(BaseModel):
    items: list[ShopItemOut]
    counts: ProductCounts
    # Distinct categories across the seller's products — the filter's options.
    categories: list[str] = []


class CommissionOut(BaseModel):
    plan_code: PlanCode
    commission_rate: float


class CopyRequest(BaseModel):
    base_item_id: uuid.UUID


class CopyResponse(BaseModel):
    title: str
    description: str
    keywords: list[str]


# ── helpers ────────────────────────────────────────────────────────────────────

def _ensure_profile(db: Session, user: User) -> SellerProfile:
    p = db.scalar(select(SellerProfile).where(SellerProfile.user_id == user.id))
    if p is None:
        p = SellerProfile(user_id=user.id)
        db.add(p)
        db.flush()
    return p


def _rate(profile: SellerProfile) -> Decimal:
    return commission_rate(profile.plan_code)


def _own_item(db: Session, profile: SellerProfile, item_id: uuid.UUID) -> ShopItem:
    """404 (not 403) when the product isn't the caller's — don't confirm it exists."""
    item = db.get(ShopItem, item_id)
    if item is None or item.seller_profile_id != profile.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
    return item


def _cost(item: BaseItem, color, size, material, print_type) -> Decimal:
    cost = Decimal(item.base_price)
    variant = next((v for v in item.variants if v.color == color and v.size == size), None)
    if variant:
        cost += Decimal(variant.price_delta)
    for opt in item.print_options:
        if opt.kind == PrintOptionKind.MATERIAL and opt.name == material:
            cost += Decimal(opt.price_delta)
        if opt.kind == PrintOptionKind.PRINT_TYPE and opt.name == print_type:
            cost += Decimal(opt.price_delta)
    return cost


# Where each state may go next. Archiving is allowed from anywhere; coming back
# always lands in draft, so a restored product gets a deliberate republish rather
# than reappearing on the storefront by surprise.
_TRANSITIONS: dict[ShopItemState, set[ShopItemState]] = {
    ShopItemState.UNLISTED: {ShopItemState.LISTED, ShopItemState.ARCHIVED},
    ShopItemState.LISTED: {ShopItemState.UNLISTED, ShopItemState.ARCHIVED},
    ShopItemState.ARCHIVED: {ShopItemState.UNLISTED},
    ShopItemState.PENDING: {ShopItemState.UNLISTED, ShopItemState.ARCHIVED},
}


def _check_transition(current: ShopItemState, target: ShopItemState) -> None:
    if target not in _TRANSITIONS.get(current, set()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Can't move a product from {current.value} to {target.value}.",
        )


def _base_with_options(db: Session, base_item_id: uuid.UUID) -> BaseItem:
    base = db.scalar(
        select(BaseItem)
        .where(BaseItem.id == base_item_id)
        .options(
            selectinload(BaseItem.variants),
            selectinload(BaseItem.print_options),
            selectinload(BaseItem.print_areas),
        )
    )
    if base is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That blank is unavailable.")
    return base


def _validate_selection(base: BaseItem, item: ShopItem) -> None:
    """A colour+size the print partner doesn't stock would produce an unfillable
    order, so it's rejected here rather than discovered at fulfilment."""
    if item.color and item.size:
        combo = next(
            (v for v in base.variants if v.color == item.color and v.size == item.size and v.is_available),
            None,
        )
        if combo is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{base.name} isn't available in {item.color} / {item.size}.",
            )
    for field, kind in (("material", PrintOptionKind.MATERIAL), ("print_type", PrintOptionKind.PRINT_TYPE)):
        chosen = getattr(item, field)
        if chosen and not any(o.kind == kind and o.name == chosen for o in base.print_options):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"“{chosen}” isn't offered for this blank.",
            )


# Fields worth remembering across an edit, in the order they read best in history.
_TRACKED = ("name", "description", "tags", "price", "state", "color", "size",
            "material", "print_type", "design_id", "print_area_id",
            "pos_x", "pos_y", "scale", "rotation")

_LABELS = {
    "name": "Name",
    "description": "Description",
    "tags": "Tags",
    "price": "Price",
    "state": "Status",
    "color": "Colour",
    "size": "Size",
    "material": "Material",
    "print_type": "Print type",
}


def _snapshot(item: ShopItem) -> dict:
    """Plain-JSON copy of the tracked fields, taken before and after a save."""
    out = {}
    for f in _TRACKED:
        value = getattr(item, f)
        if isinstance(value, Decimal):
            value = str(value)
        elif isinstance(value, ShopItemState):
            value = value.value
        elif isinstance(value, uuid.UUID):
            value = str(value)
        out[f] = value
    return out


def _describe(before: dict, after: dict) -> list[str]:
    """Human-readable change lines — what a seller wants from history, not a diff."""
    lines: list[str] = []
    for field, label in _LABELS.items():
        old, new = before[field], after[field]
        if old == new:
            continue
        if field == "price":
            lines.append(f"Price €{old} → €{new}")
        elif field == "state":
            lines.append(f"Status {PRODUCT_STATE_WORDS.get(old, old)} → {PRODUCT_STATE_WORDS.get(new, new)}")
        elif field == "description":
            lines.append("Description updated")
        elif field == "tags":
            lines.append(f"Tags → {new or 'none'}")
        else:
            lines.append(f"{label} {old or '—'} → {new or '—'}")
    if before["design_id"] != after["design_id"]:
        lines.append("Design replaced")
    elif any(before[f] != after[f] for f in ("print_area_id", "pos_x", "pos_y", "scale", "rotation")):
        lines.append("Design placement adjusted")
    return lines


PRODUCT_STATE_WORDS = {
    "UNLISTED": "Draft",
    "LISTED": "Published",
    "ARCHIVED": "Archived",
    "PENDING": "In collaboration",
}


def _artwork_changed(before: dict, after: dict) -> bool:
    return any(
        before[f] != after[f]
        for f in ("design_id", "print_area_id", "pos_x", "pos_y", "scale", "rotation")
    )


def _tags_list(item: ShopItem) -> list[str]:
    return [t for t in (item.tags or "").split(",") if t]


def _collab_ids(db: Session, items: list[ShopItem]) -> dict[uuid.UUID, uuid.UUID]:
    """shop_item_id → collaboration_id, batched (one query, not one per card)."""
    if not items:
        return {}
    rows = db.execute(
        select(Collaboration.shop_item_id, Collaboration.id).where(
            Collaboration.shop_item_id.in_([i.id for i in items])
        )
    ).all()
    return {shop_item_id: collab_id for shop_item_id, collab_id in rows}


def _out(
    db: Session,
    item: ShopItem,
    rate: Decimal,
    collab_ids: dict[uuid.UUID, uuid.UUID] | None = None,
) -> ShopItemOut:
    base = item.base_item
    design = db.get(Design, item.design_id)
    area = db.get(PrintArea, item.print_area_id) if item.print_area_id else None
    fee = (Decimal(item.price) * rate).quantize(Decimal("0.01"))
    earnings = (Decimal(item.price) - Decimal(item.production_cost) - fee).quantize(Decimal("0.01"))
    return ShopItemOut(
        id=item.id,
        name=item.name,
        description=item.description,
        tags=_tags_list(item),
        price=item.price,
        production_cost=item.production_cost,
        platform_fee=fee,
        earnings=earnings,
        state=item.state,
        base_item_id=item.base_item_id,
        base_name=base.name if base else "",
        base_image_url=base.image_url if base else None,
        design_id=item.design_id,
        design_url=design.resource_url if design else None,
        provider=base.print_shop.name if base and base.print_shop else None,
        category=base.category.name if base and base.category else None,
        pos_x=item.pos_x,
        pos_y=item.pos_y,
        scale=item.scale,
        rotation=item.rotation,
        created_at=item.created_at,
        updated_at=item.updated_at,
        collaboration_id=(collab_ids or {}).get(item.id),
        color=item.color,
        size=item.size,
        material=item.material,
        print_type=item.print_type,
        print_area=area.name if area else None,
        min_price=min_price(Decimal(item.production_cost), rate),
    )


# ── pricing + AI copy ────────────────────────────────────────────────────────────

@router.get("/commission", response_model=CommissionOut)
def get_commission(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> CommissionOut:
    profile = _ensure_profile(db, user)
    db.commit()
    return CommissionOut(plan_code=profile.plan_code, commission_rate=float(_rate(profile)))


@router.post("/ai-copy", response_model=CopyResponse)
def ai_copy(
    payload: CopyRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> CopyResponse:
    base = db.scalar(
        select(BaseItem).where(BaseItem.id == payload.base_item_id).options(selectinload(BaseItem.category))
    )
    if base is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
    copy = generate_product_copy(base.name, base.category.name if base.category else None)
    return CopyResponse(**copy)


# ── CRUD ─────────────────────────────────────────────────────────────────────────

SORTS = {
    "updated_desc": ShopItem.updated_at.desc(),
    "created_desc": ShopItem.created_at.desc(),
    "created_asc": ShopItem.created_at.asc(),
    "price_desc": ShopItem.price.desc(),
    "price_asc": ShopItem.price.asc(),
    "name_asc": ShopItem.name.asc(),
}


@router.get("", response_model=ProductList)
def list_shop_items(
    q: str | None = None,
    state: ShopItemState | None = None,
    category: str | None = None,
    created_from: date | None = None,
    created_to: date | None = None,
    sort: str = "updated_desc",
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> ProductList:
    profile = _ensure_profile(db, user)
    mine = ShopItem.seller_profile_id == profile.id

    # Counts and category options are computed over the FULL catalogue, never the
    # filtered slice — otherwise searching would make the tab badges lie.
    counts = ProductCounts(
        **{
            s.value: n
            for s, n in db.execute(
                select(ShopItem.state, func.count()).where(mine).group_by(ShopItem.state)
            ).all()
        }
    )
    categories = sorted(
        c
        for (c,) in db.execute(
            select(ItemCategory.name)
            .select_from(ShopItem)
            .join(BaseItem, BaseItem.id == ShopItem.base_item_id)
            .join(ItemCategory, ItemCategory.id == BaseItem.category_id)
            .where(mine)
            .distinct()
        ).all()
        if c
    )

    stmt = (
        select(ShopItem)
        .where(mine)
        .options(
            selectinload(ShopItem.base_item).selectinload(BaseItem.print_shop),
            selectinload(ShopItem.base_item).selectinload(BaseItem.category),
        )
    )
    if state is not None:
        stmt = stmt.where(ShopItem.state == state)
    if q:
        # Name or keyword — the two things a seller remembers about a product.
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(ShopItem.name.ilike(like), ShopItem.tags.ilike(like)))
    if category:
        stmt = (
            stmt.join(BaseItem, BaseItem.id == ShopItem.base_item_id)
            .join(ItemCategory, ItemCategory.id == BaseItem.category_id)
            .where(ItemCategory.name == category)
        )
    if created_from:
        stmt = stmt.where(ShopItem.created_at >= datetime.combine(created_from, time.min))
    if created_to:
        stmt = stmt.where(ShopItem.created_at <= datetime.combine(created_to, time.max))

    rows = db.scalars(stmt.order_by(SORTS.get(sort, SORTS["updated_desc"]))).all()
    rate = _rate(profile)
    collab_ids = _collab_ids(db, list(rows))
    return ProductList(
        items=[_out(db, r, rate, collab_ids) for r in rows],
        counts=counts,
        categories=categories,
    )


@router.get("/{item_id}", response_model=ShopItemOut)
def get_shop_item(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> ShopItemOut:
    profile = _ensure_profile(db, user)
    item = _own_item(db, profile, item_id)
    return _out(db, item, _rate(profile), _collab_ids(db, [item]))


@router.post("", response_model=ShopItemOut, status_code=status.HTTP_201_CREATED)
def create_shop_item(
    payload: ShopItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> ShopItemOut:
    profile = _ensure_profile(db, user)

    base = db.scalar(
        select(BaseItem)
        .where(BaseItem.id == payload.base_item_id, BaseItem.active.is_(True))
        .options(
            selectinload(BaseItem.variants),
            selectinload(BaseItem.print_options),
            selectinload(BaseItem.print_areas),
            selectinload(BaseItem.print_shop),
            selectinload(BaseItem.category),
        )
    )
    if base is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That blank is unavailable.")

    design = db.get(Design, payload.design_id)
    if design is None or design.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A valid design must be applied.")

    rate = _rate(profile)
    cost = _cost(base, payload.color, payload.size, payload.material, payload.print_type)
    floor = min_price(cost, rate)
    if payload.price < floor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Price must be at least €{floor} to cover production and the platform fee.",
        )

    area = None
    if payload.print_area:
        area = next((a for a in base.print_areas if a.name == payload.print_area), None)

    tags = ",".join(t.strip() for t in payload.tags if t.strip())
    item = ShopItem(
        seller_profile_id=profile.id,
        base_item_id=base.id,
        design_id=design.id,
        print_area_id=area.id if area else None,
        pos_x=payload.pos_x,
        pos_y=payload.pos_y,
        scale=payload.scale,
        rotation=payload.rotation,
        color=payload.color,
        size=payload.size,
        material=payload.material,
        print_type=payload.print_type,
        name=payload.name.strip(),
        description=(payload.description or "").strip() or None,
        tags=tags or None,
        price=payload.price,
        production_cost=cost,
        state=ShopItemState.LISTED if payload.publish else ShopItemState.UNLISTED,
    )
    db.add(item)
    db.commit()  # single transaction — an incomplete product never persists
    db.refresh(item)

    if payload.publish:  # 🔌 post-publish side effects (both stubbed seams)
        generate_mockups(str(item.id))
        index_product(str(item.id), item.name, item.tags)

    return _out(db, item, rate)


@router.patch("/{item_id}", response_model=ShopItemOut)
def update_shop_item(
    item_id: uuid.UUID,
    payload: ShopItemPatch,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> ShopItemOut:
    profile = _ensure_profile(db, user)
    item = _own_item(db, profile, item_id)
    rate = _rate(profile)
    before = _snapshot(item)

    # ── copy ─────────────────────────────────────────────────────────────────
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product name is required.")
        item.name = name
    if payload.description is not None:
        item.description = payload.description.strip() or None
    if payload.tags is not None:
        item.tags = ",".join(t.strip() for t in payload.tags if t.strip()) or None

    # ── design + placement ───────────────────────────────────────────────────
    base = _base_with_options(db, item.base_item_id)
    if payload.design_id is not None and payload.design_id != item.design_id:
        design = db.get(Design, payload.design_id)
        if design is None or design.owner_user_id != user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That design isn't yours.")
        item.design_id = design.id
    if payload.print_area is not None:
        area = next((a for a in base.print_areas if a.name == payload.print_area), None)
        if area is None:
            # A typo'd/renamed area must not silently clear the placement.
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"“{payload.print_area}” isn't a print area on this blank.",
            )
        item.print_area_id = area.id
    for field in ("pos_x", "pos_y", "scale", "rotation"):
        value = getattr(payload, field)
        if value is not None:
            setattr(item, field, value)

    # ── variant + options: re-derive the cost they imply ─────────────────────
    # "" means "cleared" (how the editor removes a material/print type) and is
    # stored as NULL, so cleared and never-set look the same everywhere.
    variant_changed = False
    for field in ("color", "size", "material", "print_type"):
        value = getattr(payload, field)
        if value is None:
            continue
        norm = value.strip() or None
        if norm != getattr(item, field):
            setattr(item, field, norm)
            variant_changed = True
    if variant_changed:
        _validate_selection(base, item)
        item.production_cost = _cost(base, item.color, item.size, item.material, item.print_type)

    # ── price: checked only when price or cost actually moved, so a plan
    # downgrade that raised the floor can't block an unrelated rename ─────────
    floor = min_price(Decimal(item.production_cost), rate)
    if payload.price is not None:
        item.price = payload.price
    if (payload.price is not None or variant_changed) and Decimal(item.price) < floor:
        detail = f"Price must be at least €{floor}."
        if variant_changed:
            detail = (
                f"That option raises production cost to €{item.production_cost} — "
                f"the minimum price is now €{floor}."
            )
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

    # ── visibility ───────────────────────────────────────────────────────────
    newly_listed = False
    if payload.state is not None and payload.state != item.state:
        _check_transition(item.state, payload.state)
        if payload.state == ShopItemState.LISTED and item.design_id is None:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Apply a design before publishing this product.",
            )
        newly_listed = payload.state == ShopItemState.LISTED
        item.state = payload.state

    after = _snapshot(item)
    summary = _describe(before, after)
    if summary:
        db.add(
            ShopItemRevision(
                shop_item_id=item.id,
                actor_user_id=user.id,
                summary=summary,
                before={k: v for k, v in before.items() if before[k] != after[k]},
            )
        )

    db.commit()
    db.refresh(item)

    # 🔌 Artwork or placement moved → the rendered mockups are stale.
    if _artwork_changed(before, after):
        generate_mockups(str(item.id))
    if newly_listed:
        generate_mockups(str(item.id))
        index_product(str(item.id), item.name, item.tags)
    return _out(db, item, rate, _collab_ids(db, [item]))


@router.get("/{item_id}/revisions", response_model=list[RevisionOut])
def list_revisions(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> list[RevisionOut]:
    profile = _ensure_profile(db, user)
    item = _own_item(db, profile, item_id)
    rows = db.scalars(
        select(ShopItemRevision)
        .where(ShopItemRevision.shop_item_id == item.id)
        .order_by(ShopItemRevision.created_at.desc())
        .limit(50)
    ).all()
    return [RevisionOut(id=r.id, summary=r.summary or [], created_at=r.created_at) for r in rows]


@router.post("/{item_id}/duplicate", response_model=ShopItemOut, status_code=status.HTTP_201_CREATED)
def duplicate_shop_item(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> ShopItemOut:
    """Copy a product as a fresh draft — the usual way to make a colour or
    wording variant without redoing the design placement."""
    profile = _ensure_profile(db, user)
    src = _own_item(db, profile, item_id)

    copy = ShopItem(
        seller_profile_id=profile.id,
        base_item_id=src.base_item_id,
        design_id=src.design_id,
        print_area_id=src.print_area_id,
        pos_x=src.pos_x,
        pos_y=src.pos_y,
        scale=src.scale,
        rotation=src.rotation,
        color=src.color,
        size=src.size,
        material=src.material,
        print_type=src.print_type,
        name=f"{src.name} (copy)"[:255],
        description=src.description,
        tags=src.tags,
        price=src.price,
        production_cost=src.production_cost,
        # Always a draft: a duplicate is never something buyers asked to see.
        state=ShopItemState.UNLISTED,
    )
    db.add(copy)
    db.commit()
    db.refresh(copy)
    return _out(db, copy, _rate(profile))


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shop_item(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> None:
    profile = _ensure_profile(db, user)
    item = _own_item(db, profile, item_id)
    # A live listing can't be deleted out from under the buyers looking at it.
    if item.state == ShopItemState.LISTED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unpublish or archive this product before deleting it.",
        )
    db.delete(item)
    db.commit()
