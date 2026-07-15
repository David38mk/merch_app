"""Representative router: PrintShop-owned catalog. Shows the full pattern
(public reads + role-guarded writes) that the stub routers will follow."""

import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.database import get_db
from app.models.catalog import BaseItem, ItemCategory
from app.models.enums import Role
from app.models.user import User

router = APIRouter(prefix="/catalog", tags=["catalog"])


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str


class BaseItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    description: str | None
    base_price: Decimal
    active: bool


class BaseItemCreate(BaseModel):
    name: str
    description: str | None = None
    base_price: Decimal = Decimal("0")
    category_id: uuid.UUID | None = None


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)) -> list[ItemCategory]:
    return list(db.scalars(select(ItemCategory)))


@router.get("/base-items", response_model=list[BaseItemOut])
def list_base_items(db: Session = Depends(get_db)) -> list[BaseItem]:
    """Public: the blanks sellers can design on."""
    return list(db.scalars(select(BaseItem).where(BaseItem.active.is_(True))))


@router.post("/base-items", response_model=BaseItemOut, status_code=status.HTTP_201_CREATED)
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
        category_id=payload.category_id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
