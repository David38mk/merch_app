"""Discount-code resolution — shared by the cart's validate endpoint and the
checkout that actually applies the code, so the rules live in one place."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.pricing import discount_amount
from app.models.commerce import DiscountCode


def resolve_discount(
    db: Session,
    code: str | None,
    seller_profile_id: uuid.UUID,
    subtotal: Decimal,
) -> tuple[DiscountCode | None, Decimal, str | None]:
    """Return (code_row, amount, error). No code → (None, 0, None). An invalid
    code → (None, 0, message). A valid code → (row, amount, None)."""
    if not code or not code.strip():
        return None, Decimal("0.00"), None

    row = db.scalar(select(DiscountCode).where(func.lower(DiscountCode.code) == code.strip().lower()))
    if row is None:
        return None, Decimal("0.00"), "That code isn't valid."
    if not row.active:
        return None, Decimal("0.00"), "This code is no longer active."
    if row.expires_at is not None and datetime.now(timezone.utc) > row.expires_at:
        return None, Decimal("0.00"), "This code has expired."
    if row.seller_profile_id is not None and row.seller_profile_id != seller_profile_id:
        return None, Decimal("0.00"), "This code isn't valid for this brand."
    if row.max_uses is not None and row.used_count >= row.max_uses:
        return None, Decimal("0.00"), "This code has reached its usage limit."
    if row.min_subtotal is not None and Decimal(subtotal) < row.min_subtotal:
        return None, Decimal("0.00"), f"Spend at least €{row.min_subtotal} to use this code."

    amount = discount_amount((row.kind.value, row.value), subtotal)
    return row, amount, None
