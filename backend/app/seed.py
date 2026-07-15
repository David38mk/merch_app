"""Seed reference data (subscription plans). Run after migrations:

    python -m app.seed
"""

from decimal import Decimal

from app.core.database import SessionLocal
from app.models.platform import Plan

PLANS = [
    # code, monthly_price, commission_rate, product_limit, ai_monthly_quota
    ("FREE", Decimal("0"), Decimal("0.15"), 5, 10),
    ("CREATOR", Decimal("19"), Decimal("0.10"), None, 9999),
    ("PRO", Decimal("49"), Decimal("0.05"), None, 9999),
]


def seed_plans() -> None:
    db = SessionLocal()
    try:
        for code, price, rate, limit, quota in PLANS:
            plan = db.get(Plan, code)
            if plan is None:
                db.add(
                    Plan(
                        code=code,
                        monthly_price=price,
                        commission_rate=rate,
                        product_limit=limit,
                        ai_monthly_quota=quota,
                    )
                )
        db.commit()
        print(f"Seeded {len(PLANS)} plans.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_plans()
