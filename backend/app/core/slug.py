import re
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import SellerProfile


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s or "brand"


def unique_slug(db: Session, name: str, exclude_id: uuid.UUID | None = None) -> str:
    """A URL slug derived from `name`, guaranteed unique across seller profiles."""
    base = slugify(name)
    slug = base
    i = 2
    while True:
        existing = db.scalar(select(SellerProfile).where(SellerProfile.slug == slug))
        if existing is None or existing.id == exclude_id:
            return slug
        slug = f"{base}-{i}"
        i += 1
