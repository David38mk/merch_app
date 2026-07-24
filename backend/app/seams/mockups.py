"""🔌 SEAM: mockup rendering (MVP-SCOPE seam #2).

MVP preview is a CSS overlay of the art on the blank photo — no realistic render.
On publish we'd normally kick off mockup generation; here it's a logged no-op.
"""


def generate_mockups(shop_item_id: str) -> None:
    """STUB: real impl renders photorealistic mockups and stores their URLs."""
    print(f"[mockups:stub] would render mockups for shop_item={shop_item_id}")
