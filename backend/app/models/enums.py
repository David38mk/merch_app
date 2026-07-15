import enum


class Role(str, enum.Enum):
    BUYER = "BUYER"
    SELLER = "SELLER"
    DESIGNER = "DESIGNER"
    PRINTSHOP = "PRINTSHOP"


class StoreState(str, enum.Enum):
    LIVE = "LIVE"
    DRAFT = "DRAFT"


class PlanCode(str, enum.Enum):
    FREE = "FREE"
    CREATOR = "CREATOR"
    PRO = "PRO"


class AccountType(str, enum.Enum):
    PERSONAL = "PERSONAL"
    COMPANY = "COMPANY"


class SocialPlatform(str, enum.Enum):
    INSTAGRAM = "INSTAGRAM"
    YOUTUBE = "YOUTUBE"
    TIKTOK = "TIKTOK"
    FACEBOOK = "FACEBOOK"
    WEBSITE = "WEBSITE"
    X = "X"
    OTHER = "OTHER"


class DesignType(str, enum.Enum):
    PERSONAL = "PERSONAL"
    PAID = "PAID"


class DesignSource(str, enum.Enum):
    UPLOAD = "UPLOAD"
    AI = "AI"  # 🔌 seam: real generation stubbed


class ShopItemState(str, enum.Enum):
    LISTED = "LISTED"
    UNLISTED = "UNLISTED"
    PENDING = "PENDING"  # still a collaboration


class PrintOptionKind(str, enum.Enum):
    MATERIAL = "MATERIAL"
    PRINT_TYPE = "PRINT_TYPE"


class PaymentType(str, enum.Enum):
    FIXED = "FIXED"
    PERCENT = "PERCENT"
    BOTH = "BOTH"


class CallStatus(str, enum.Enum):
    OPEN = "OPEN"
    AWARDED = "AWARDED"
    CLOSED = "CLOSED"


class BidStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"


class CollabState(str, enum.Enum):
    PENDING = "PENDING"
    PREVIEW = "PREVIEW"
    PREVIEW_ACCEPTED = "PREVIEW_ACCEPTED"
    FINAL = "FINAL"
    FINAL_ACCEPTED = "FINAL_ACCEPTED"
    PAYMENT = "PAYMENT"  # 🔌 seam: escrow/payout stubbed
    COMPLETED = "COMPLETED"


class SubmissionKind(str, enum.Enum):
    PREVIEW = "PREVIEW"
    FINAL = "FINAL"


class SubmissionDecision(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"


class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    FULFILLED = "FULFILLED"
    CANCELLED = "CANCELLED"


class FulfillmentStatus(str, enum.Enum):
    PAID = "PAID"
    IN_PRODUCTION = "IN_PRODUCTION"
    HANDED_TO_SHIPMENT = "HANDED_TO_SHIPMENT"  # 🔌 seam: cargo/tracking after this


class NotificationType(str, enum.Enum):
    SALE = "SALE"
    NEW_BID = "NEW_BID"
    BID_ACCEPTED = "BID_ACCEPTED"
    COLLAB_UPDATE = "COLLAB_UPDATE"
    NEW_PRODUCTION_ORDER = "NEW_PRODUCTION_ORDER"
    SYSTEM = "SYSTEM"


class AICreditReason(str, enum.Enum):
    PLAN_GRANT = "PLAN_GRANT"
    AI_GENERATION = "AI_GENERATION"
    ADDON = "ADDON"  # ⏭️ deferred: add-on packs
