"""Helpers for creating in-app notifications.

Kept separate from the router so any flow (register, a future sale, a bid, …) can
push a notification without importing the API layer. Delivery to email/push is a
seam (see app.seams.delivery); this only writes the in-app row.
"""

import uuid

from sqlalchemy.orm import Session

from app.models.enums import NotificationType
from app.models.platform import Notification
from app.models.user import User


def push(
    db: Session,
    user_id: uuid.UUID,
    type: NotificationType,
    title: str,
    body: str,
    link_url: str | None = None,
) -> Notification:
    """Add a notification to the session (caller commits)."""
    n = Notification(user_id=user_id, type=type, title=title, body=body, link_url=link_url)
    db.add(n)
    return n


def seed_welcome(db: Session, user: User) -> None:
    """Two starter notifications so a brand-new dashboard isn't empty."""
    first = (user.first_name or "there").strip() or "there"
    push(
        db,
        user.id,
        NotificationType.SYSTEM,
        "Welcome to MyHappinessClub 🎉",
        f"Hi {first}! Finish setting up your brand to start selling.",
        link_url="/dashboard",
    )
    push(
        db,
        user.id,
        NotificationType.SYSTEM,
        "Tip: publish your storefront",
        "Add a logo and description, then hit Publish to get a public store URL.",
        link_url="/seller/storefront",
    )
