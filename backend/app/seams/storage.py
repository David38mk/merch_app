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


def save_design_image(data: bytes, content_type: str | None) -> str:
    """Store uploaded/generated artwork. Unlike ``save_image`` this PRESERVES
    transparency (designs need it) and passes SVG through untouched.

    SVG is stored raw and unprocessed — a real deployment would sanitize it
    (strip scripts) as a follow-up seam. Returns the public URL.
    """
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if len(data) > max_bytes:
        raise StorageError(f"File is too large (max {settings.MAX_UPLOAD_MB} MB).")

    if content_type == "image/svg+xml":
        name = f"{uuid.uuid4().hex}.svg"
        (_upload_dir() / name).write_bytes(data)
        return f"{settings.UPLOAD_URL_PREFIX}/{name}"

    if content_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise StorageError("Design must be a PNG, JPG, WebP or SVG file.")

    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except (UnidentifiedImageError, OSError):
        raise StorageError("That file isn't a readable image.")

    # Keep alpha when present so artwork can sit transparently on the blank.
    image = image.convert("RGBA") if image.mode in ("RGBA", "LA", "P") else image.convert("RGB")
    image.thumbnail((settings.DESIGN_MAX_PX, settings.DESIGN_MAX_PX))

    out = io.BytesIO()
    image.save(out, format="PNG")  # PNG keeps alpha losslessly for print art
    name = f"{uuid.uuid4().hex}.png"
    (_upload_dir() / name).write_bytes(out.getvalue())
    return f"{settings.UPLOAD_URL_PREFIX}/{name}"


def save_attachment(data: bytes, content_type: str | None) -> str:
    """Store a job attachment: reference images are optimized like any photo,
    brand-guideline PDFs are passed through untouched. Returns the public URL."""
    if content_type == "application/pdf":
        max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
        if len(data) > max_bytes:
            raise StorageError(f"File is too large (max {settings.MAX_UPLOAD_MB} MB).")
        name = f"{uuid.uuid4().hex}.pdf"
        (_upload_dir() / name).write_bytes(data)
        return f"{settings.UPLOAD_URL_PREFIX}/{name}"
    return save_image(data, content_type, max_px=settings.COVER_MAX_PX)


def copy_stored_file(url: str | None) -> str | None:
    """Duplicate a stored file and return the new URL, so two records never share
    one blob (deleting one would otherwise break the other)."""
    if not url or not url.startswith(f"{settings.UPLOAD_URL_PREFIX}/"):
        return url
    name = url.rsplit("/", 1)[-1]
    src = _upload_dir() / name
    if not src.exists():
        return url
    suffix = src.suffix or ""
    new_name = f"{uuid.uuid4().hex}{suffix}"
    (_upload_dir() / new_name).write_bytes(src.read_bytes())
    return f"{settings.UPLOAD_URL_PREFIX}/{new_name}"


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
