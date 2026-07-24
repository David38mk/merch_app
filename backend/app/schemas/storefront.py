import enum
import re

from pydantic import BaseModel, Field, field_validator

from app.models.enums import SocialPlatform, StoreState


class PublishStatus(str, enum.Enum):
    """Derived, never stored — see `_status()` in the storefront router.

    DRAFT       never published; no public URL yet
    PUBLISHED   live at /store/{slug}
    UNPUBLISHED was live, seller took it down; republishing restores it
    """

    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    UNPUBLISHED = "UNPUBLISHED"

# Description length cap (spec: "Description has a character limit").
DESCRIPTION_MAX = 500

# Social platforms offered in the builder, in display order.
SOCIAL_PLATFORMS: list[SocialPlatform] = [
    SocialPlatform.INSTAGRAM,
    SocialPlatform.TIKTOK,
    SocialPlatform.YOUTUBE,
    SocialPlatform.FACEBOOK,
    SocialPlatform.X,
    SocialPlatform.WEBSITE,
]

DEFAULT_THEME = {"primary": "#6366f1", "accent": "#ec4899", "button_style": "rounded"}
BUTTON_STYLES = {"rounded", "pill", "square"}

_URL_RE = re.compile(r"^https?://[^\s/$.?#].[^\s]*$", re.IGNORECASE)
_HEX_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


def normalize_url(value: str | None) -> str | None:
    """Trim, default the scheme to https://, and validate. Blank → None (cleared)."""
    if value is None:
        return None
    v = value.strip()
    if not v:
        return None
    if not re.match(r"^https?://", v, re.IGNORECASE):
        v = f"https://{v}"
    if not _URL_RE.match(v):
        raise ValueError("Enter a valid URL (e.g. https://instagram.com/yourbrand).")
    return v


class SocialLinksPayload(BaseModel):
    """The full desired set of social links. Blank/omitted fields clear that link."""

    instagram: str | None = None
    tiktok: str | None = None
    youtube: str | None = None
    facebook: str | None = None
    x: str | None = None
    website: str | None = None

    @field_validator("*")
    @classmethod
    def _valid_url(cls, v: str | None) -> str | None:
        return normalize_url(v)

    def as_map(self) -> dict[SocialPlatform, str]:
        pairs = {
            SocialPlatform.INSTAGRAM: self.instagram,
            SocialPlatform.TIKTOK: self.tiktok,
            SocialPlatform.YOUTUBE: self.youtube,
            SocialPlatform.FACEBOOK: self.facebook,
            SocialPlatform.X: self.x,
            SocialPlatform.WEBSITE: self.website,
        }
        return {platform: url for platform, url in pairs.items() if url}


class ThemePayload(BaseModel):
    primary: str | None = None
    accent: str | None = None
    button_style: str | None = None

    @field_validator("primary", "accent")
    @classmethod
    def _hex(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        v = v.strip()
        if not _HEX_RE.match(v):
            raise ValueError("Colour must be a hex value like #6366f1.")
        return v

    @field_validator("button_style")
    @classmethod
    def _style(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if v not in BUTTON_STYLES:
            raise ValueError(f"Button style must be one of: {', '.join(sorted(BUTTON_STYLES))}.")
        return v


class CurationPayload(BaseModel):
    """Homepage product curation — ordering, hiding and featuring, by product id."""

    order: list[str] = []
    hidden: list[str] = []
    featured: list[str] = []


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class StorefrontDraftUpdate(BaseModel):
    """Partial autosave of the draft. Only the keys present are written."""

    brand_name: str | None = None
    creator_name: str | None = None
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX)
    slug: str | None = None
    contact_email: str | None = None
    location: str | None = None
    socials: SocialLinksPayload | None = None
    theme: ThemePayload | None = None
    curation: CurationPayload | None = None

    @field_validator("contact_email")
    @classmethod
    def _email(cls, v: str | None) -> str | None:
        # "" stays "" — that's how a seller clears the field from the draft.
        if v is None or not v.strip():
            return v
        v = v.strip()
        if not _EMAIL_RE.match(v):
            raise ValueError("Enter a valid contact email (e.g. hello@yourbrand.com).")
        return v


class CurationOut(BaseModel):
    order: list[str] = []
    hidden: list[str] = []
    featured: list[str] = []


class ThemeOut(BaseModel):
    primary: str
    accent: str
    button_style: str


class StorefrontConfig(BaseModel):
    """What the builder edits — draft values merged over the published ones."""

    brand_name: str | None = None
    creator_name: str | None = None
    description: str | None = None
    slug: str | None = None
    logo_url: str | None = None
    cover_url: str | None = None
    contact_email: str | None = None
    location: str | None = None
    socials: dict[str, str] = {}
    theme: ThemeOut
    curation: CurationOut


class BuilderProduct(BaseModel):
    """A listed product the seller can curate on the homepage."""

    id: str
    name: str
    price: str
    base_image_url: str | None = None
    design_url: str | None = None
    pos_x: float = 50
    pos_y: float = 45
    scale: float = 0.45
    rotation: float = 0


class SlugCheck(BaseModel):
    """Live availability feedback while the seller types a store URL."""

    slug: str
    available: bool
    reason: str | None = None
    suggestion: str | None = None


class StorefrontState(BaseModel):
    config: StorefrontConfig
    has_unpublished_changes: bool
    store_state: StoreState = StoreState.DRAFT
    is_published: bool = False
    published_at: str | None = None
    products: list[BuilderProduct] = []

    # ── publishing ───────────────────────────────────────────────────────────
    # DRAFT (never published) | PUBLISHED | UNPUBLISHED (was live, taken down).
    # Derived from store_state + published_at so it can't drift out of sync.
    status: PublishStatus = PublishStatus.DRAFT
    # The live URL — absolute once a public domain is configured, else app-relative.
    store_url: str | None = None
    # The slug the draft would publish under (differs from config.slug only in shape).
    pending_slug: str | None = None
    slug_check: SlugCheck | None = None
    last_published_at: str | None = None
    version: int = 1
    # Empty = ready to publish. Each entry is a human-readable blocker.
    blockers: list[str] = []


class PublicVariant(BaseModel):
    color: str
    size: str


class PublicProduct(BaseModel):
    """A LISTED product on a public storefront (design composited over the blank)."""

    id: str
    name: str
    price: str
    category: str | None = None  # from the blank — powers storefront filtering
    # In-stock colour/size combos — what the buy-now dialog lets a buyer pick.
    variants: list[PublicVariant] = []
    base_image_url: str | None = None
    design_url: str | None = None
    pos_x: float = 50
    pos_y: float = 50
    scale: float = 0.45
    rotation: float = 0
    featured: bool = False


class PublicStorefront(BaseModel):
    """Public, buyer-facing view of a LIVE storefront (published values only)."""

    brand_name: str
    creator_name: str | None = None
    description: str | None = None
    slug: str
    logo_url: str | None = None
    cover_url: str | None = None
    contact_email: str | None = None
    location: str | None = None
    socials: dict[str, str] = {}
    theme: ThemeOut
    products: list[PublicProduct] = []
