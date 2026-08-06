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


class AddressType(str, enum.Enum):
    SHIPPING = "SHIPPING"
    BILLING = "BILLING"


class DiscountKind(str, enum.Enum):
    PERCENT = "PERCENT"  # value = percent off (e.g. 10 → 10%)
    FIXED = "FIXED"      # value = fixed amount off in €


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
    LISTED = "LISTED"  # published — visible on the storefront
    UNLISTED = "UNLISTED"  # draft — created but never/no longer published
    PENDING = "PENDING"  # still a collaboration
    # Retired. Hidden from the storefront and the main tabs, but kept for history
    # (and, later, for the orders that reference it). Restorable to a draft.
    ARCHIVED = "ARCHIVED"


class PrintOptionKind(str, enum.Enum):
    MATERIAL = "MATERIAL"
    PRINT_TYPE = "PRINT_TYPE"


class PaymentType(str, enum.Enum):
    FIXED = "FIXED"
    PERCENT = "PERCENT"
    BOTH = "BOTH"


class CallStatus(str, enum.Enum):
    DRAFT = "DRAFT"  # not yet visible to designers
    OPEN = "OPEN"  # published to the designer marketplace
    AWARDED = "AWARDED"
    CLOSED = "CLOSED"


class AttachmentKind(str, enum.Enum):
    REFERENCE = "REFERENCE"
    BRAND_GUIDELINE = "BRAND_GUIDELINE"


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


class CollabEventType(str, enum.Enum):
    """Append-only activity log for a Collaboration (the workspace timeline)."""

    CREATED = "CREATED"
    STARTED = "STARTED"
    DRAFT_SUBMITTED = "DRAFT_SUBMITTED"
    REVISION_REQUESTED = "REVISION_REQUESTED"
    DRAFT_APPROVED = "DRAFT_APPROVED"
    FINAL_SUBMITTED = "FINAL_SUBMITTED"
    APPROVED = "APPROVED"
    PAYMENT_COMPLETED = "PAYMENT_COMPLETED"
    PRODUCT_CREATED = "PRODUCT_CREATED"
    COMPLETED = "COMPLETED"


class SubmissionDecision(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"


class OrderStatus(str, enum.Enum):
    """The MONEY facts about an order. Production progress lives on the items
    (FulfillmentStatus); the 7 statuses sellers see are derived from both."""

    PENDING = "PENDING"  # awaiting payment
    PAID = "PAID"
    FULFILLED = "FULFILLED"  # legacy — display status is derived from items now
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"


class FulfillmentStatus(str, enum.Enum):
    PAID = "PAID"
    IN_PRODUCTION = "IN_PRODUCTION"
    QUALITY_CHECK = "QUALITY_CHECK"
    HANDED_TO_SHIPMENT = "HANDED_TO_SHIPMENT"  # legacy — SHIPPED supersedes it
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"


class OrderEventType(str, enum.Enum):
    PLACED = "PLACED"
    PAID = "PAID"
    SENT_TO_PROVIDER = "SENT_TO_PROVIDER"  # lands in the print shop's queue
    IN_PRODUCTION = "IN_PRODUCTION"
    QUALITY_CHECK = "QUALITY_CHECK"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"


class ReviewStatus(str, enum.Enum):
    """Product-review moderation state. Reviews auto-publish and are hidden
    reactively (report threshold, or a future admin action)."""

    PUBLISHED = "PUBLISHED"
    HIDDEN = "HIDDEN"


class NotificationType(str, enum.Enum):
    SALE = "SALE"  # a new sale happened
    ORDER = "ORDER"  # an existing order progressed (production/shipped/delivered)
    PAYMENT = "PAYMENT"  # money moved: refunds, payouts
    NEW_BID = "NEW_BID"
    BID_ACCEPTED = "BID_ACCEPTED"
    COLLAB_UPDATE = "COLLAB_UPDATE"
    NEW_PRODUCTION_ORDER = "NEW_PRODUCTION_ORDER"
    ANNOUNCEMENT = "ANNOUNCEMENT"  # platform announcements
    REVIEW = "REVIEW"  # review requests / product-review activity
    PROMOTION = "PROMOTION"  # ⏭️ promo engine emits these (buyer-facing)
    WISHLIST = "WISHLIST"  # ⏭️ back-in-stock / price-drop on a saved product
    SYSTEM = "SYSTEM"


class AICreditReason(str, enum.Enum):
    PLAN_GRANT = "PLAN_GRANT"
    AI_GENERATION = "AI_GENERATION"
    ADDON = "ADDON"  # ⏭️ deferred: add-on packs
