"""Plan-based commission + the minimum retail price rule.

Shared by product creation and the collaboration workspace (which pre-fills a
draft product's price), so the break-even rule lives in exactly one place.
"""

import math
from decimal import Decimal

from app.core.config import settings
from app.models.enums import PlanCode

COMMISSION_RATES: dict[PlanCode, Decimal] = {
    PlanCode.FREE: Decimal("0.15"),
    PlanCode.CREATOR: Decimal("0.10"),
    PlanCode.PRO: Decimal("0.05"),
}


def commission_rate(plan_code: PlanCode) -> Decimal:
    return COMMISSION_RATES.get(plan_code, Decimal("0.15"))


def min_price(cost: Decimal, rate: Decimal) -> Decimal:
    """Break-even retail price: price − cost − rate·price = 0 → cost / (1 − rate)."""
    raw = Decimal(cost) / (Decimal(1) - rate)
    return Decimal(math.ceil(raw * 100)) / 100


# ── buyer-facing cart totals (shipping / tax / total) ─────────────────────────

_CENTS = Decimal("0.01")


def shipping_for(subtotal: Decimal) -> Decimal:
    """Flat shipping, waived above the free-shipping threshold (real cargo
    pricing is deferred, seam #4). Zero on an empty subtotal."""
    if subtotal <= 0:
        return Decimal("0.00")
    if subtotal >= Decimal(settings.FREE_SHIPPING_OVER):
        return Decimal("0.00")
    return Decimal(settings.SHIPPING_FLAT).quantize(_CENTS)


def order_totals(subtotal: Decimal, discount: Decimal) -> dict[str, Decimal]:
    """Given product subtotal and a resolved discount, return the buyer-facing
    money breakdown. Discount is platform-absorbed — it never touches payout."""
    subtotal = Decimal(subtotal).quantize(_CENTS)
    discount = min(Decimal(discount).quantize(_CENTS), subtotal)  # never below zero
    taxable = subtotal - discount
    tax = (taxable * Decimal(settings.TAX_RATE)).quantize(_CENTS)
    shipping = shipping_for(subtotal)
    total = (taxable + shipping + tax).quantize(_CENTS)
    return {"discount": discount, "shipping": shipping, "tax": tax, "total": total}


def discount_amount(kind_value: tuple[str, Decimal], subtotal: Decimal) -> Decimal:
    """Compute the € discount for a code kind+value against a subtotal, capped."""
    kind, value = kind_value
    subtotal = Decimal(subtotal)
    if kind == "PERCENT":
        amt = (subtotal * Decimal(value) / Decimal(100)).quantize(_CENTS)
    else:  # FIXED
        amt = Decimal(value).quantize(_CENTS)
    return min(max(amt, Decimal("0.00")), subtotal)
