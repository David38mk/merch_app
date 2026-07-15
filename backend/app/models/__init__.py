"""Import every model so Base.metadata is fully populated (Alembic + relationship resolution)."""

from app.models.base import Base
from app.models.catalog import BaseItem, BaseItemVariant, ItemCategory, PrintArea, PrintOption
from app.models.commerce import Cart, CartItem, Order, OrderItem
from app.models.design import Design
from app.models.hiring import Bid, ChatMessage, CollabSubmission, Collaboration, DesignerCall
from app.models.platform import AICreditTransaction, Notification, Plan
from app.models.shop import ShopItem
from app.models.user import (
    DesignerProfile,
    PayoutDetails,
    PrintShopProfile,
    SellerProfile,
    Settings,
    SocialLink,
    User,
    UserRole,
)

__all__ = [
    "Base",
    "User",
    "UserRole",
    "SellerProfile",
    "DesignerProfile",
    "PrintShopProfile",
    "Settings",
    "PayoutDetails",
    "SocialLink",
    "ItemCategory",
    "BaseItem",
    "BaseItemVariant",
    "PrintOption",
    "PrintArea",
    "Design",
    "ShopItem",
    "DesignerCall",
    "Bid",
    "Collaboration",
    "CollabSubmission",
    "ChatMessage",
    "Cart",
    "CartItem",
    "Order",
    "OrderItem",
    "Notification",
    "Plan",
    "AICreditTransaction",
]
