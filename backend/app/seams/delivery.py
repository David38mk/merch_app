"""🔌 SEAM: notification delivery (email/push) and cargo/shipment tracking.
MVP notifications are in-app only; fulfillment ends at HANDED_TO_SHIPMENT.
Email is stubbed: instead of sending, we log the link so the flow is testable.
"""


def send_email(to: str, subject: str, body: str) -> None:
    """STUB: log instead of send. Real impl: transactional email provider."""
    print(f"\n[email:stub] to={to} | {subject}\n{body}\n")


def send_password_reset(to: str, reset_url: str) -> None:
    send_email(to, "Reset your MyHappinessClub password", f"Reset link: {reset_url}")


def send_verification(to: str, verify_url: str) -> None:
    send_email(to, "Verify your MyHappinessClub email", f"Verification link: {verify_url}")


def create_shipment(order_item_id: str) -> dict:
    """STUB: no real cargo. Real impl: cargo/courier API → tracking number + notifications."""
    return {"status": "stub", "tracking_number": None, "order_item_id": order_item_id}
