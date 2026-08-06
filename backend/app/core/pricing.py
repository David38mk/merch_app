"""Plan-based commission + the minimum retail price rule.

Shared by product creation and the collaboration workspace (which pre-fills a
draft product's price), so the break-even rule lives in exactly one place.
"""

import math
from datetime import date, timedelta
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

# Shipping options shown at checkout. Real cargo pricing is deferred (seam #4);
# these are config-shaped stand-ins. `free_over` waives the fee above a subtotal.
SHIPPING_METHODS: dict[str, dict] = {
    "standard": {
        "label": "Standard",
        "estimate": "5–7 business days",
        "days": (5, 7),  # business-day window, drives the delivery estimate
        "cost": lambda: Decimal(settings.SHIPPING_FLAT),
        "free_over": lambda: Decimal(settings.FREE_SHIPPING_OVER),
    },
    "express": {
        "label": "Express",
        "estimate": "2–3 business days",
        "days": (2, 3),
        "cost": lambda: Decimal("12.99"),
        "free_over": lambda: None,
    },
}

DEFAULT_METHOD = "standard"


def _add_business_days(start: date, n: int) -> date:
    """Advance `n` business days from `start` (skips Sat/Sun). Print-on-demand
    ships from the provider, so weekends don't count toward the estimate."""
    d = start
    added = 0
    while added < n:
        d += timedelta(days=1)
        if d.weekday() < 5:  # Mon–Fri
            added += 1
    return d


def delivery_window(placed_on: date, method: str = DEFAULT_METHOD) -> tuple[date, date]:
    """The (earliest, latest) delivery date for a method, snapshotted at order
    time so the buyer's confirmation, email and history all show the same dates."""
    spec = SHIPPING_METHODS.get(method) or SHIPPING_METHODS[DEFAULT_METHOD]
    lo, hi = spec["days"]
    return _add_business_days(placed_on, lo), _add_business_days(placed_on, hi)


def shipping_for(subtotal: Decimal, method: str = DEFAULT_METHOD) -> Decimal:
    """Cost of the chosen shipping method for a subtotal, waived above its
    free-shipping threshold. Zero on an empty subtotal."""
    if subtotal <= 0:
        return Decimal("0.00")
    spec = SHIPPING_METHODS.get(method) or SHIPPING_METHODS[DEFAULT_METHOD]
    free_over = spec["free_over"]()
    if free_over is not None and subtotal >= free_over:
        return Decimal("0.00")
    return spec["cost"]().quantize(_CENTS)


def order_totals(subtotal: Decimal, discount: Decimal, method: str = DEFAULT_METHOD) -> dict[str, Decimal]:
    """Given product subtotal, a resolved discount and a shipping method, return
    the buyer-facing money breakdown. Discount is platform-absorbed — it never
    touches payout."""
    subtotal = Decimal(subtotal).quantize(_CENTS)
    discount = min(Decimal(discount).quantize(_CENTS), subtotal)  # never below zero
    taxable = subtotal - discount
    tax = (taxable * Decimal(settings.TAX_RATE)).quantize(_CENTS)
    shipping = shipping_for(subtotal, method)
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
