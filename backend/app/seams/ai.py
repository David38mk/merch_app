"""🔌 SEAM: GenAI image generation. Real provider (e.g. an image model API) later.

The stub generates deterministic abstract placeholder art from the prompt so the
whole design flow (prompt → candidates → pick → place) is real end-to-end. Swap
``generate_design_candidates`` for a real model call that returns PNG bytes.
"""

import hashlib
import io

from PIL import Image, ImageDraw, ImageFont

PLACEHOLDER_IMAGE = "https://placehold.co/1024x1024?text=AI+design+(stub)"


def generate_design(prompt: str) -> str:
    """Legacy single-URL stub (kept for compatibility)."""
    return PLACEHOLDER_IMAGE


def _font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def _candidate(prompt: str, index: int) -> bytes:
    """One deterministic placeholder image seeded by (prompt, index)."""
    h = hashlib.md5(f"{prompt}|{index}".encode()).digest()
    bg = (h[0] // 2 + 40, h[1] // 2 + 40, h[2] // 2 + 40)
    fg = (h[3], h[4], h[5])
    ac = (h[6], h[7], h[8])

    img = Image.new("RGB", (900, 900), bg)
    draw = ImageDraw.Draw(img, "RGBA")

    # A few translucent blobs positioned from the hash — varies per candidate.
    for k in range(7):
        cx = (h[(k * 2) % 16] * 4) % 900
        cy = (h[(k * 2 + 1) % 16] * 4) % 900
        r = 90 + (h[k % 16] % 260)
        col = (fg if k % 2 else ac) + (70,)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)

    # Prompt label on a translucent bar so the candidate is recognisable.
    label = (prompt or "AI design").strip()[:60]
    f = _font(38)
    tb = draw.textbbox((0, 0), label, font=f)
    tw = tb[2] - tb[0]
    draw.rectangle([0, 800, 900, 880], fill=(0, 0, 0, 120))
    draw.text(((900 - tw) / 2, 818), label, font=f, fill=(255, 255, 255))
    draw.text((16, 16), f"AI · candidate {index + 1} (stub)", font=_font(24), fill=(255, 255, 255, 200))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def generate_design_candidates(prompt: str, n: int = 4) -> list[bytes]:
    """STUB: return `n` PNG byte-blobs. Real impl: call the image model."""
    return [_candidate(prompt, i) for i in range(n)]


def generate_product_copy(base_name: str, category: str | None) -> dict:
    """🔌 SEAM (text): product title / description / keywords.

    STUB: templated copy from the blank + category. Real impl: an LLM call.
    """
    cat = (category or "product").lower()
    base = base_name.strip() or "Custom product"
    title = f"{base} — Limited Custom Edition"
    description = (
        f"A one-of-a-kind {cat} you won't find anywhere else. This {base.lower()} is made to order "
        f"and printed on demand, so every piece is fresh. Soft, durable and built to last — grab yours "
        f"before it's gone."
    )
    words = {w.lower().strip(",.") for w in f"{base} {cat}".split() if len(w) > 2}
    keywords = sorted(words | {"custom", "print on demand", "limited edition", "streetwear"})
    return {"title": title, "description": description, "keywords": keywords}
