"""Google Sign-In: verify the ID token that Google Identity Services returns.
Gated on GOOGLE_CLIENT_ID — empty means the feature is off.
"""

from app.core.config import settings


def google_enabled() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID)


def verify_google_credential(credential: str) -> dict:
    """Verify a Google ID token and return its claims (email, given_name, ...).

    Raises ValueError if Google isn't configured or the token is invalid.
    """
    if not google_enabled():
        raise ValueError("Google sign-in is not configured on the server.")

    # Imported lazily so the app boots even if google-auth isn't installed yet.
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    try:
        info = id_token.verify_oauth2_token(credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID)
    except Exception as exc:  # invalid/expired token, wrong audience, etc.
        raise ValueError("Invalid Google credential.") from exc

    if not info.get("email"):
        raise ValueError("Google account has no email.")
    return info
