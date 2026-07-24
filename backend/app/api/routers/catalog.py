"""Print-partner catalog. Public reads (browse/search/filter/detail + facets),
seller-only favorites, and print-shop-only writes. This is the seller's
'Create product → browse blanks' surface."""

import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_optional_user, require_role
from app.core.database import get_db
from app.models.catalog import (
    BaseItem,
    BaseItemVariant,
    CatalogFavorite,
    ItemCategory,
    PrintArea,
    PrintOption,
)
from app.models.enums import PrintOptionKind, Role
from app.models.user import PrintShopProfile, User

router = APIRouter(prefix="/catalog", tags=["catalog"])


# ── schemas ────────────────────────────────────────────────────────────────────

class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str


class ProviderOut(BaseModel):
    id: uuid.UUID
    name: str


class FacetsOut(BaseModel):
    categories: list[CategoryOut]
    providers: list[ProviderOut]
    colors: list[str]
    materials: list[str]
    print_methods: list[str]
    price_min: float
    price_max: float


class BaseItemCard(BaseModel):
    id: uuid.UUID
    name: str
    base_price: Decimal
    image_url: str | None
    provider: str
    provider_id: uuid.UUID
    category: str | None
    category_id: uuid.UUID | None
    colors: list[str]
    print_areas: list[str]
    materials: list[str]
    print_methods: list[str]
    available: bool
    is_favorite: bool


class VariantOut(BaseModel):
    size: str
    color: str
    price_delta: Decimal
    is_available: bool


class PrintOptionOut(BaseModel):
    kind: str  # "MATERIAL" | "PRINT_TYPE"
    name: str
    price_delta: Decimal


class BaseItemDetail(BaseItemCard):
    description: str | None
    production_time: str | None
    sizes: list[str]
    variants: list[VariantOut]
    print_options: list[PrintOptionOut]


class CatalogPage(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[BaseItemCard]


class FavoriteState(BaseModel):
    is_favorite: bool


class BaseItemCreate(BaseModel):
    name: str
    description: str | None = None
    base_price: Decimal = Decimal("0")
    image_url: str | None = None
    category_id: uuid.UUID | None = None


class BaseItemCreated(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str


# ── builders ───────────────────────────────────────────────────────────────────

def _colors(item: BaseItem) -> list[str]:
    return sorted({v.color for v in item.variants})


def _sizes(item: BaseItem) -> list[str]:
    return sorted({v.size for v in item.variants})


def _options(item: BaseItem, kind: PrintOptionKind) -> list[str]:
    return sorted({o.name for o in item.print_options if o.kind == kind})


def _available(item: BaseItem) -> bool:
    if not item.variants:
        return item.active
    return item.active and any(v.is_available for v in item.variants)


def _card(item: BaseItem, favorites: set[uuid.UUID]) -> BaseItemCard:
    return BaseItemCard(
        id=item.id,
        name=item.name,
        base_price=item.base_price,
        image_url=item.image_url,
        provider=item.print_shop.name if item.print_shop else "Unknown",
        provider_id=item.print_shop_profile_id,
        category=item.category.name if item.category else None,
        category_id=item.category_id,
        colors=_colors(item),
        print_areas=[a.name for a in item.print_areas],
        materials=_options(item, PrintOptionKind.MATERIAL),
        print_methods=_options(item, PrintOptionKind.PRINT_TYPE),
        available=_available(item),
        is_favorite=item.id in favorites,
    )


def _favorite_ids(db: Session, user: User | None) -> set[uuid.UUID]:
    if user is None:
        return set()
    return set(db.scalars(select(CatalogFavorite.base_item_id).where(CatalogFavorite.user_id == user.id)))


# ── browse / search / filter ─────────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)) -> list[ItemCategory]:
    return list(db.scalars(select(ItemCategory).order_by(ItemCategory.name)))


@router.get("/facets", response_model=FacetsOut)
def get_facets(db: Session = Depends(get_db)) -> FacetsOut:
    """Distinct filter values actually present in the active catalog, so the
    filter UI can never offer a value that returns nothing."""
    active = BaseItem.active.is_(True)

    categories = list(
        db.scalars(select(ItemCategory).join(BaseItem).where(active).distinct().order_by(ItemCategory.name))
    )
    provider_rows = db.execute(
        select(PrintShopProfile.id, PrintShopProfile.name)
        .join(BaseItem, BaseItem.print_shop_profile_id == PrintShopProfile.id)
        .where(active)
        .distinct()
        .order_by(PrintShopProfile.name)
    ).all()

    colors = list(
        db.scalars(
            select(BaseItemVariant.color)
            .join(BaseItem, BaseItemVariant.base_item_id == BaseItem.id)
            .where(active)
            .distinct()
            .order_by(BaseItemVariant.color)
        )
    )
    materials = list(
        db.scalars(
            select(PrintOption.name)
            .join(BaseItem, PrintOption.base_item_id == BaseItem.id)
            .where(active, PrintOption.kind == PrintOptionKind.MATERIAL)
            .distinct()
            .order_by(PrintOption.name)
        )
    )
    methods = list(
        db.scalars(
            select(PrintOption.name)
            .join(BaseItem, PrintOption.base_item_id == BaseItem.id)
            .where(active, PrintOption.kind == PrintOptionKind.PRINT_TYPE)
            .distinct()
            .order_by(PrintOption.name)
        )
    )
    lo, hi = db.execute(select(func.min(BaseItem.base_price), func.max(BaseItem.base_price)).where(active)).one()

    return FacetsOut(
        categories=[CategoryOut.model_validate(c) for c in categories],
        providers=[ProviderOut(id=r[0], name=r[1]) for r in provider_rows],
        colors=colors,
        materials=materials,
        print_methods=methods,
        price_min=float(lo or 0),
        price_max=float(hi or 0),
    )


@router.get("/base-items", response_model=CatalogPage)
def list_base_items(
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
    search: str | None = None,
    category_id: uuid.UUID | None = None,
    provider_id: uuid.UUID | None = None,
    color: str | None = None,
    material: str | None = None,
    print_method: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    available_only: bool = False,
    favorites_only: bool = False,
    sort: str = Query("newest", pattern="^(newest|price_asc|price_desc|name)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=48),
) -> CatalogPage:
    favorites = _favorite_ids(db, user)

    stmt = select(BaseItem).where(BaseItem.active.is_(True))

    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                BaseItem.name.ilike(term),
                BaseItem.description.ilike(term),
                BaseItem.category.has(ItemCategory.name.ilike(term)),
            )
        )
    if category_id:
        stmt = stmt.where(BaseItem.category_id == category_id)
    if provider_id:
        stmt = stmt.where(BaseItem.print_shop_profile_id == provider_id)
    if color:
        stmt = stmt.where(BaseItem.variants.any(BaseItemVariant.color == color))
    if material:
        stmt = stmt.where(
            BaseItem.print_options.any(and_(PrintOption.kind == PrintOptionKind.MATERIAL, PrintOption.name == material))
        )
    if print_method:
        stmt = stmt.where(
            BaseItem.print_options.any(
                and_(PrintOption.kind == PrintOptionKind.PRINT_TYPE, PrintOption.name == print_method)
            )
        )
    if min_price is not None:
        stmt = stmt.where(BaseItem.base_price >= min_price)
    if max_price is not None:
        stmt = stmt.where(BaseItem.base_price <= max_price)
    if available_only:
        stmt = stmt.where(BaseItem.variants.any(BaseItemVariant.is_available.is_(True)))
    if favorites_only:
        if user is None:
            return CatalogPage(total=0, page=page, page_size=page_size, items=[])
        stmt = stmt.where(BaseItem.id.in_(favorites or {uuid.UUID(int=0)}))

    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0

    order = {
        "newest": BaseItem.created_at.desc(),
        "price_asc": BaseItem.base_price.asc(),
        "price_desc": BaseItem.base_price.desc(),
        "name": BaseItem.name.asc(),
    }[sort]

    stmt = (
        stmt.order_by(order)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .options(
            selectinload(BaseItem.variants),
            selectinload(BaseItem.print_options),
            selectinload(BaseItem.print_areas),
            selectinload(BaseItem.category),
            selectinload(BaseItem.print_shop),
        )
    )
    items = list(db.scalars(stmt))
    return CatalogPage(
        total=total,
        page=page,
        page_size=page_size,
        items=[_card(i, favorites) for i in items],
    )


@router.get("/base-items/{item_id}", response_model=BaseItemDetail)
def get_base_item(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> BaseItemDetail:
    item = db.scalar(
        select(BaseItem)
        .where(BaseItem.id == item_id, BaseItem.active.is_(True))
        .options(
            selectinload(BaseItem.variants),
            selectinload(BaseItem.print_options),
            selectinload(BaseItem.print_areas),
            selectinload(BaseItem.category),
            selectinload(BaseItem.print_shop),
        )
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    favorites = _favorite_ids(db, user)
    card = _card(item, favorites)
    return BaseItemDetail(
        **card.model_dump(),
        description=item.description,
        production_time=item.production_time,
        sizes=_sizes(item),
        variants=[
            VariantOut(size=v.size, color=v.color, price_delta=v.price_delta, is_available=v.is_available)
            for v in item.variants
        ],
        print_options=[
            PrintOptionOut(kind=o.kind.value, name=o.name, price_delta=o.price_delta)
            for o in item.print_options
        ],
    )


# ── favorites (seller) ───────────────────────────────────────────────────────────

@router.post("/base-items/{item_id}/favorite", response_model=FavoriteState)
def add_favorite(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> FavoriteState:
    if db.get(BaseItem, item_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
    exists = db.scalar(
        select(CatalogFavorite).where(
            CatalogFavorite.user_id == user.id, CatalogFavorite.base_item_id == item_id
        )
    )
    if exists is None:
        db.add(CatalogFavorite(user_id=user.id, base_item_id=item_id))
        db.commit()
    return FavoriteState(is_favorite=True)


@router.delete("/base-items/{item_id}/favorite", response_model=FavoriteState)
def remove_favorite(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SELLER)),
) -> FavoriteState:
    row = db.scalar(
        select(CatalogFavorite).where(
            CatalogFavorite.user_id == user.id, CatalogFavorite.base_item_id == item_id
        )
    )
    if row is not None:
        db.delete(row)
        db.commit()
    return FavoriteState(is_favorite=False)


# ── print-shop writes ────────────────────────────────────────────────────────────

@router.post("/base-items", response_model=BaseItemCreated, status_code=status.HTTP_201_CREATED)
def create_base_item(
    payload: BaseItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.PRINTSHOP)),
) -> BaseItem:
    """PrintShop self-manages its catalog."""
    shop = user.printshop_profile
    if shop is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Set up your print shop profile before adding catalog items.",
        )
    item = BaseItem(
        print_shop_profile_id=shop.id,
        name=payload.name,
        description=payload.description,
        base_price=payload.base_price,
        image_url=payload.image_url,
        category_id=payload.category_id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
