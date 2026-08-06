"""Product reviews & ratings — verified-purchase gated, auto-published with
reactive moderation (report threshold → auto-hide; a `status` field is ready for
a future Admin Panel). Photos reuse the storage seam (save_image).

Verified purchase = the buyer owns a PAID order whose line for THIS product
reached DELIVERED. One review per (buyer, product); body must meet a min length.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, get_optional_user, require_role
from app.core.config import settings
from app.core.database import get_db
from app.models.commerce import Order, OrderItem, ProductReview, ReviewPhoto, ReviewReport
from app.models.enums import FulfillmentStatus, OrderStatus, ReviewStatus, Role
from app.models.shop import ShopItem
from app.models.user import User
from app.seams.storage import StorageError, save_image

router = APIRouter(tags=["reviews"])

REVIEW_MIN_BODY = 20        # chars — the "minimum length requirement"
REVIEW_MAX_PHOTOS = 5
REPORT_HIDE_THRESHOLD = 3   # reports before a review auto-hides pending review


# ── schemas ──────────────────────────────────────────────────────────────────

class ReviewOut(BaseModel):
    id: uuid.UUID
    reviewer_name: str
    rating: int
    title: str
    body: str
    photos: list[str]
    created_at: datetime
    mine: bool = False
    can_report: bool = False


class ReviewSummary(BaseModel):
    average: float
    count: int
    breakdown: dict[int, int]  # {5: n, 4: n, … 1: n}


class ProductReviewsOut(BaseModel):
    summary: ReviewSummary
    photos: list[str]          # every customer photo across reviews (the strip)
    items: list[ReviewOut]


class EligibilityOut(BaseModel):
    can_review: bool
    reason: str | None = None
    has_review: bool = False
    review: ReviewOut | None = None


class ReviewIn(BaseModel):
    shop_item_id: uuid.UUID
    rating: int = Field(ge=1, le=5)
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1)
    photo_urls: list[str] = Field(default_factory=list)


class ReportIn(BaseModel):
    reason: str | None = None


# ── helpers ──────────────────────────────────────────────────────────────────

def _delivered_purchase(db: Session, user_id: uuid.UUID, shop_item_id: uuid.UUID) -> Order | None:
    """The buyer's PAID order whose line for this product is DELIVERED — the
    'verified purchaser' proof."""
    return db.scalar(
        select(Order)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(
            Order.buyer_user_id == user_id,
            Order.status == OrderStatus.PAID,
            OrderItem.shop_item_id == shop_item_id,
            OrderItem.fulfillment_status == FulfillmentStatus.DELIVERED,
        )
        .limit(1)
    )


def _out(r: ProductReview, *, viewer: User | None) -> ReviewOut:
    mine = viewer is not None and r.buyer_user_id == viewer.id
    return ReviewOut(
        id=r.id,
        reviewer_name=r.reviewer_name,
        rating=r.rating,
        title=r.title,
        body=r.body,
        photos=[p.url for p in r.photos],
        created_at=r.created_at,
        mine=mine,
        can_report=viewer is not None and not mine,
    )


def product_rating(db: Session, shop_item_id: uuid.UUID) -> tuple[float | None, int]:
    """(average, count) over PUBLISHED reviews — used by the product detail
    header. Kept here so the review rules live in one module."""
    avg, count = db.execute(
        select(func.avg(ProductReview.rating), func.count(ProductReview.id)).where(
            ProductReview.shop_item_id == shop_item_id,
            ProductReview.status == ReviewStatus.PUBLISHED,
        )
    ).one()
    return (round(float(avg), 2) if avg is not None else None, int(count or 0))


# ── public: reviews on the product page ──────────────────────────────────────

@router.get("/marketplace/products/{product_id}/reviews", response_model=ProductReviewsOut)
def product_reviews(
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),
) -> ProductReviewsOut:
    reviews = db.scalars(
        select(ProductReview)
        .where(ProductReview.shop_item_id == product_id, ProductReview.status == ReviewStatus.PUBLISHED)
        .options(selectinload(ProductReview.photos))
        .order_by(ProductReview.created_at.desc())
    ).all()

    breakdown = {n: 0 for n in range(1, 6)}
    for r in reviews:
        breakdown[r.rating] = breakdown.get(r.rating, 0) + 1
    count = len(reviews)
    average = round(sum(r.rating for r in reviews) / count, 2) if count else 0.0
    photos = [p.url for r in reviews for p in r.photos]

    return ProductReviewsOut(
        summary=ReviewSummary(average=average, count=count, breakdown=breakdown),
        photos=photos,
        items=[_out(r, viewer=viewer) for r in reviews],
    )


# ── buyer: eligibility, submit, delete, photo upload ─────────────────────────

@router.get("/buyer/reviews/eligibility", response_model=EligibilityOut)
def eligibility(
    shop_item_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.BUYER)),
) -> EligibilityOut:
    existing = db.scalar(
        select(ProductReview)
        .where(ProductReview.buyer_user_id == user.id, ProductReview.shop_item_id == shop_item_id)
        .options(selectinload(ProductReview.photos))
    )
    if existing is not None:
        return EligibilityOut(
            can_review=False, reason="You've already reviewed this product.",
            has_review=True, review=_out(existing, viewer=user),
        )
    if _delivered_purchase(db, user.id, shop_item_id) is None:
        return EligibilityOut(
            can_review=False,
            reason="Only buyers who have received this item can review it.",
        )
    return EligibilityOut(can_review=True)


@router.post("/buyer/reviews/photo")
async def upload_review_photo(
    file: UploadFile = File(...),
    user: User = Depends(require_role(Role.BUYER)),
) -> dict:
    """Upload one review photo (🔌 storage seam), returns its URL. The submit
    call then references the returned URLs."""
    data = await file.read()
    try:
        url = save_image(data, file.content_type, max_px=settings.COVER_MAX_PX)
    except StorageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return {"url": url}


@router.post("/buyer/reviews", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
def create_review(
    payload: ReviewIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.BUYER)),
) -> ReviewOut:
    if len(payload.body.strip()) < REVIEW_MIN_BODY:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Your review must be at least {REVIEW_MIN_BODY} characters.",
        )
    if db.get(ShopItem, payload.shop_item_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    order = _delivered_purchase(db, user.id, payload.shop_item_id)
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only buyers who have received this item can review it.",
        )
    if db.scalar(
        select(ProductReview).where(
            ProductReview.buyer_user_id == user.id, ProductReview.shop_item_id == payload.shop_item_id
        )
    ):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You've already reviewed this product.")

    review = ProductReview(
        shop_item_id=payload.shop_item_id,
        buyer_user_id=user.id,
        order_id=order.id,
        reviewer_name=user.display_name or user.first_name or "Verified buyer",
        rating=payload.rating,
        title=payload.title.strip(),
        body=payload.body.strip(),
        status=ReviewStatus.PUBLISHED,
    )
    db.add(review)
    db.flush()
    for url in payload.photo_urls[:REVIEW_MAX_PHOTOS]:
        db.add(ReviewPhoto(review_id=review.id, url=url))
    db.commit()
    db.refresh(review)
    return _out(review, viewer=user)


@router.delete("/buyer/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    review_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.BUYER)),
) -> None:
    review = db.get(ProductReview, review_id)
    if review is None or review.buyer_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found.")
    db.delete(review)
    db.commit()


# ── report (any logged-in user) ──────────────────────────────────────────────

@router.post("/reviews/{review_id}/report")
def report_review(
    review_id: uuid.UUID,
    payload: ReportIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    review = db.get(ProductReview, review_id)
    if review is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found.")
    if review.buyer_user_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't report your own review.")

    existing = db.scalar(
        select(ReviewReport).where(
            ReviewReport.review_id == review_id, ReviewReport.reporter_user_id == user.id
        )
    )
    if existing is None:
        db.add(ReviewReport(review_id=review_id, reporter_user_id=user.id, reason=(payload.reason or "").strip() or None))
        review.report_count += 1
        # Reactive moderation: enough reports pull it off the page pending review.
        if review.report_count >= REPORT_HIDE_THRESHOLD and review.status == ReviewStatus.PUBLISHED:
            review.status = ReviewStatus.HIDDEN
        db.commit()
    return {"reported": True, "hidden": review.status == ReviewStatus.HIDDEN}
