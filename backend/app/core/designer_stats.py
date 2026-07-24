"""Aggregate signals shown next to a designer (applicant cards + profile page).

All batch-computed for a set of designer profiles so lists stay one query each.
Response time is *derived* from how quickly a designer applies after a job is
published — no fabricated column, and it upgrades to real chat latency later.
"""

import statistics
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.design import Design
from app.models.enums import CollabState
from app.models.hiring import Bid, Collaboration, DesignerCall, DesignerReview
from app.models.user import DesignerProfile


def rating_stats(db: Session, designer_ids: list[uuid.UUID]) -> dict[uuid.UUID, tuple[float, int]]:
    """designer_id → (average rating, review count)."""
    if not designer_ids:
        return {}
    rows = db.execute(
        select(
            DesignerReview.designer_profile_id,
            func.avg(DesignerReview.rating),
            func.count(DesignerReview.id),
        )
        .where(DesignerReview.designer_profile_id.in_(designer_ids))
        .group_by(DesignerReview.designer_profile_id)
    ).all()
    return {r[0]: (round(float(r[1]), 1), int(r[2])) for r in rows}


def completed_counts(db: Session, designer_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    """designer_id → number of completed collaborations."""
    if not designer_ids:
        return {}
    rows = db.execute(
        select(Collaboration.designer_profile_id, func.count(Collaboration.id))
        .where(
            Collaboration.designer_profile_id.in_(designer_ids),
            Collaboration.state == CollabState.COMPLETED,
        )
        .group_by(Collaboration.designer_profile_id)
    ).all()
    return {r[0]: int(r[1]) for r in rows}


def response_hours(db: Session, designer_ids: list[uuid.UUID]) -> dict[uuid.UUID, float | None]:
    """designer_id → median hours between a job being published and them applying."""
    if not designer_ids:
        return {}
    rows = db.execute(
        select(Bid.designer_profile_id, Bid.created_at, DesignerCall.published_at)
        .join(DesignerCall, Bid.call_id == DesignerCall.id)
        .where(Bid.designer_profile_id.in_(designer_ids), DesignerCall.published_at.is_not(None))
    ).all()

    buckets: dict[uuid.UUID, list[float]] = {}
    for designer_id, applied_at, published_at in rows:
        if applied_at is None or published_at is None:
            continue
        hours = (applied_at - published_at).total_seconds() / 3600
        if hours >= 0:
            buckets.setdefault(designer_id, []).append(hours)
    return {d: round(statistics.median(v), 1) for d, v in buckets.items() if v}


def portfolio_previews(
    db: Session, designer_ids: list[uuid.UUID], per_designer: int = 3
) -> dict[uuid.UUID, list[str]]:
    """designer_id → a few of their artwork URLs (designs are owned by the user)."""
    if not designer_ids:
        return {}
    profiles = db.scalars(
        select(DesignerProfile).where(DesignerProfile.id.in_(designer_ids))
    ).all()
    by_user = {p.user_id: p.id for p in profiles}
    if not by_user:
        return {}

    designs = db.scalars(
        select(Design)
        .where(Design.owner_user_id.in_(list(by_user)))
        .order_by(Design.created_at.desc())
    ).all()

    out: dict[uuid.UUID, list[str]] = {}
    for d in designs:
        designer_id = by_user.get(d.owner_user_id)
        if designer_id is None:
            continue
        bucket = out.setdefault(designer_id, [])
        if len(bucket) < per_designer:
            bucket.append(d.resource_url)
    return out
