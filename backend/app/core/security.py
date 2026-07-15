import re
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Passwords ────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str | None) -> bool:
    if not hashed:  # OAuth-only account has no local password
        return False
    return pwd_context.verify(plain, hashed)


_PW_MIN = 8


def validate_password_strength(password: str) -> None:
    """Raise ValueError with a clear message if the password is too weak."""
    if len(password) < _PW_MIN:
        raise ValueError(f"Password must be at least {_PW_MIN} characters.")
    if not re.search(r"[A-Za-z]", password):
        raise ValueError("Password must contain at least one letter.")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one number.")


# ── Tokens ───────────────────────────────────────────────────────────────────
# Every token carries a `type` claim so a reset token can't be used as a login
# token, and vice-versa.

def _create_token(subject: str, token_type: str, expires_minutes: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    payload = {"sub": subject, "exp": expire, "type": token_type}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(subject: str, remember: bool = False) -> str:
    minutes = settings.REMEMBER_TOKEN_EXPIRE_MINUTES if remember else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    return _create_token(subject, "access", minutes)


def create_reset_token(subject: str) -> str:
    return _create_token(subject, "reset", settings.RESET_TOKEN_EXPIRE_MINUTES)


def create_verify_token(subject: str) -> str:
    return _create_token(subject, "verify", settings.VERIFY_TOKEN_EXPIRE_MINUTES)


def decode_token(token: str, expected_type: str) -> str | None:
    """Return the subject (user id) if the token is valid AND of the expected type."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
    if payload.get("type") != expected_type:
        return None
    return payload.get("sub")


def decode_access_token(token: str) -> str | None:
    return decode_token(token, "access")
