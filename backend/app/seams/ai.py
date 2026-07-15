"""🔌 SEAM: GenAI image generation. Real provider (e.g. image model API) later."""

PLACEHOLDER_IMAGE = "https://placehold.co/1024x1024?text=AI+design+(stub)"


def generate_design(prompt: str) -> str:
    """Return a URL to a generated image. STUB: returns a placeholder.
    Real impl: call the image model, store the result (see storage seam), return its URL.
    """
    return PLACEHOLDER_IMAGE
