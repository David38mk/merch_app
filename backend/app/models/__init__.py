"""Import every model so Base.metadata is fully populated (Alembic + relationship resolution)."""

from app.models.base import Base
from app.models.catalog import (
    BaseItem,
    BaseItemVariant,
    CatalogFavorite,
    ItemCategory,
    PrintArea,
    PrintOption,
)
from app.models.commerce import (
    Cart,
    CartItem,
    DiscountCode,
    Order,
    OrderEvent,
    OrderItem,
    StoreVisit,
)
from app.models.design import Design
from app.models.hiring import (
    Bid,
    CallAttachment,
    ChatMessage,
    CollabEvent,
    CollabSubmission,
    Collaboration,
    DesignerCall,
    DesignerReview,
)
from app.models.platform import AICreditTransaction, Notification, Plan
from app.models.shop import ShopItem, ShopItemRevision
from app.models.user import (
    Address,
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
    "Address",
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
    "CatalogFavorite",
    "Design",
    "ShopItem",
    "ShopItemRevision",
    "DesignerCall",
    "CallAttachment",
    "Bid",
    "Collaboration",
    "CollabSubmission",
    "ChatMessage",
    "CollabEvent",
    "DesignerReview",
    "Cart",
    "CartItem",
    "Order",
    "OrderItem",
    "OrderEvent",
    "StoreVisit",
    "DiscountCode",
    "Notification",
    "Plan",
    "AICreditTransaction",
]
