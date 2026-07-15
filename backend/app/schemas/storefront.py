import re

from pydantic import BaseModel, Field, field_validator

from app.models.enums import SocialPlatform, StoreState

# Description length cap (spec: "Description has a character limit").
DESCRIPTION_MAX = 500

# Social platforms offered in the brand editor, in display order.
SOCIAL_PLATFORMS: list[SocialPlatform] = [
    SocialPlatform.INSTAGRAM,
    SocialPlatform.TIKTOK,
    SocialPlatform.FACEBOOK,
    SocialPlatform.YOUTUBE,
    SocialPlatform.WEBSITE,
]

_URL_RE = re.compile(r"^https?://[^\s/$.?#].[^\s]*$", re.IGNORECASE)


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
    facebook: str | None = None
    youtube: str | None = None
    website: str | None = None

    @field_validator("*")
    @classmethod
    def _valid_url(cls, v: str | None) -> str | None:
        return normalize_url(v)

    def as_map(self) -> dict[SocialPlatform, str]:
        """Only the platforms that have a URL, keyed by the enum."""
        pairs = {
            SocialPlatform.INSTAGRAM: self.instagram,
            SocialPlatform.TIKTOK: self.tiktok,
            SocialPlatform.FACEBOOK: self.facebook,
            SocialPlatform.YOUTUBE: self.youtube,
            SocialPlatform.WEBSITE: self.website,
        }
        return {platform: url for platform, url in pairs.items() if url}


class StorefrontUpdate(BaseModel):
    """Partial save — only the fields present are written (draft autosave / Save draft)."""

    brand_name: str | None = None
    creator_name: str | None = None
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX)
    # Custom store URL slug; slugified + uniqueness-checked server-side.
    slug: str | None = None
    socials: SocialLinksPayload | None = None


class StorefrontState(BaseModel):
    """Everything the editor needs to render + resume."""

    brand_name: str | None = None
    creator_name: str | None = None
    description: str | None = None
    slug: str | None = None
    logo_url: str | None = None
    cover_url: str | None = None
    socials: dict[str, str] = {}
    store_state: StoreState = StoreState.DRAFT
    is_published: bool = False
    published_at: str | None = None


class PublicStorefront(BaseModel):
    """Public, buyer-facing view of a LIVE storefront."""

    brand_name: str
    creator_name: str | None = None
    description: str | None = None
    slug: str
    logo_url: str | None = None
    cover_url: str | None = None
    socials: dict[str, str] = {}
    # Products aren't built yet — the grid renders a "coming soon" stub for now.
    products: list = []
