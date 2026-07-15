"""🔌 SEAM: file / image storage (MVP-SCOPE seam #7).

MVP writes uploads to local disk under ``settings.UPLOAD_DIR`` and serves them at
``settings.UPLOAD_URL_PREFIX`` (mounted in ``app.main``). The real implementation
swaps this module for S3 / Cloudinary + a CDN — callers only ever see the returned
public URL, so nothing else changes.

The "optimize" step lives here: every image is decoded, down-scaled to a max edge,
stripped of metadata and re-encoded to WebP so stored files stay small.
"""

import io
import uuid
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from app.core.config import settings

# What the browser is allowed to send. We re-encode to WebP regardless, but we
# still gate on the incoming type so non-images are rejected early.
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


class StorageError(ValueError):
    """Raised for a bad upload (wrong type, too big, unreadable). Router → HTTP 400."""


def _upload_dir() -> Path:
    d = Path(settings.UPLOAD_DIR)
    d.mkdir(parents=True, exist_ok=True)
    return d


def save_image(data: bytes, content_type: str | None, *, max_px: int) -> str:
    """Validate + optimize an uploaded image; return its public URL.

    Raises ``StorageError`` (→ 400) on anything the user can fix.
    """
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise StorageError("Image must be a JPG, PNG or WebP file.")

    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if len(data) > max_bytes:
        raise StorageError(f"Image is too large (max {settings.MAX_UPLOAD_MB} MB).")

    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except (UnidentifiedImageError, OSError):
        raise StorageError("That file isn't a readable image.")

    # Flatten transparency onto white so PNG art with alpha still renders as WebP.
    if image.mode in ("RGBA", "LA", "P"):
        rgba = image.convert("RGBA")
        background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        image = Image.alpha_composite(background, rgba).convert("RGB")
    else:
        image = image.convert("RGB")

    # Downscale the longest edge to max_px (thumbnail never upscales) — the optimize step.
    image.thumbnail((max_px, max_px))

    out = io.BytesIO()
    image.save(out, format="WEBP", quality=82, method=4)

    name = f"{uuid.uuid4().hex}.webp"
    (_upload_dir() / name).write_bytes(out.getvalue())
    return f"{settings.UPLOAD_URL_PREFIX}/{name}"


def delete_image(url: str | None) -> None:
    """Best-effort removal of a previously stored local file. No-op for anything
    that isn't one of our own upload URLs (e.g. a Google avatar)."""
    if not url or not url.startswith(f"{settings.UPLOAD_URL_PREFIX}/"):
        return
    name = url.rsplit("/", 1)[-1]
    try:
        (_upload_dir() / name).unlink(missing_ok=True)
    except OSError:
        pass
