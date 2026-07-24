import re
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import SellerProfile

SLUG_MIN = 3
SLUG_MAX = 32

# Words we can never hand out as a store URL: they either collide with an app
# route today or are the kind of name we'd want back later (root-level slugs are
# the end goal, so the list is deliberately generous).
RESERVED_SLUGS = frozenset(
    """
    about account accounts admin administrator api app apps assets auth billing blog
    cart careers checkout contact dashboard designer designers docs edit faq favicon
    help home images img jobs legal login logout mail me my new news order orders
    preview pricing printshop privacy profile public robots root search seller sellers
    settings shop signin signup static store stores studio support terms test undefined
    upload uploads user users www
    """.split()
)

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s or "brand"


def normalize_slug(raw: str) -> str:
    """What the seller typed, coerced into slug shape ('My Brand!' → 'my-brand').

    No 'brand' fallback here: input that normalizes to nothing ('!!!', '日本語')
    must surface as a format error, never silently become a slug the seller
    didn't ask for. The fallback belongs only to auto-generation (unique_slug).
    """
    s = re.sub(r"[^a-z0-9]+", "-", raw.lower()).strip("-")
    return s[:SLUG_MAX].strip("-")


def slug_error(slug: str) -> str | None:
    """Format/reservation problems. None = the shape is fine (may still be taken)."""
    if not slug:
        return "Store URL must contain letters or numbers."
    if len(slug) < SLUG_MIN:
        return f"Store URL must be at least {SLUG_MIN} characters."
    if len(slug) > SLUG_MAX:
        return f"Store URL must be at most {SLUG_MAX} characters."
    if not _SLUG_RE.match(slug):
        return "Use lowercase letters, numbers and single hyphens only."
    if slug in RESERVED_SLUGS:
        return "That store URL is reserved. Pick another one."
    return None


def slug_taken(db: Session, slug: str, exclude_id: uuid.UUID | None = None) -> bool:
    existing = db.scalar(select(SellerProfile).where(SellerProfile.slug == slug))
    return existing is not None and existing.id != exclude_id


def unique_slug(db: Session, name: str, exclude_id: uuid.UUID | None = None) -> str:
    """A URL slug derived from `name`, guaranteed valid and unique across sellers."""
    base = normalize_slug(name) or "brand"
    if len(base) < SLUG_MIN:
        base = f"{base}-store"
    candidate = base
    i = 2
    while slug_error(candidate) or slug_taken(db, candidate, exclude_id):
        # rstrip so a truncation cut landing on a hyphen can't emit "...--2",
        # which would fail validation and waste a DB check per suffix.
        stem = base[: SLUG_MAX - len(str(i)) - 1].rstrip("-")
        candidate = f"{stem}-{i}"
        i += 1
    return candidate


def store_url(slug: str | None) -> str | None:
    """Absolute public URL when a domain is configured, else an app-relative path."""
    if not slug:
        return None
    base = settings.PUBLIC_STORE_BASE_URL.strip().rstrip("/")
    return f"{base}/{slug}" if base else f"/store/{slug}"
