"""🔌 SEAM: payment gateway (Stripe) — checkout, subscription billing, designer escrow.
MVP marks orders paid with no real charge.
"""


def charge_order(order_id: str, amount: float) -> dict:
    """STUB: pretend the charge succeeded. Real impl: create a Stripe PaymentIntent."""
    return {"status": "paid", "provider": "stub", "order_id": order_id, "amount": amount}


def pay_designer(collab_id: str, amount) -> dict:
    """STUB: no real transfer. Real impl: release escrow / payout to the designer."""
    print(f"[payments:stub] would pay designer for collab={collab_id} amount={amount}")
    return {"status": "paid", "provider": "stub", "collab_id": collab_id}


def start_subscription(seller_profile_id: str, plan_code: str) -> dict:
    """STUB: no real billing. Real impl: Stripe Checkout / Billing session."""
    return {"status": "active", "provider": "stub", "plan": plan_code}
