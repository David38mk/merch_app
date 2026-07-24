import uuid
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_payload
from app.models.enums import Role
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
# Same scheme but doesn't 401 when no token is present — for public-but-personalized
# endpoints (e.g. the catalog knows your favorites if you're logged in).
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

_credentials_exc = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def _resolve_user(token: str, db: Session) -> User | None:
    payload = decode_access_payload(token)
    if payload is None:
        return None
    try:
        user_id = uuid.UUID(payload.get("sub") or "")
    except ValueError:
        return None
    user = db.get(User, user_id)
    if user is None:
        return None
    # "Log out of all devices": tokens issued before the revocation cut are dead.
    # A token with no iat (pre-upgrade) is also dead once a cut exists — safe side.
    if user.sessions_revoked_at is not None:
        iat = payload.get("iat")
        issued = datetime.fromtimestamp(iat, tz=timezone.utc) if iat else None
        # JWT iat is whole-second; floor the cut too, or a token minted in the
        # same second as the revocation (the replacement token!) reads as stale.
        cut = user.sessions_revoked_at.replace(microsecond=0)
        if issued is None or issued < cut:
            return None
    return user


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    user = _resolve_user(token, db)
    if user is None:
        raise _credentials_exc
    return user


def get_optional_user(
    token: str | None = Depends(oauth2_scheme_optional), db: Session = Depends(get_db)
) -> User | None:
    """Return the current user if a valid token is present, else None (no error)."""
    if not token:
        return None
    return _resolve_user(token, db)


def require_role(role: Role):
    """Dependency factory: ensure the current user holds a given role
    (and has verified their email, when verification is enabled)."""

    def _checker(user: User = Depends(get_current_user)) -> User:
        if settings.EMAIL_VERIFICATION_ENABLED and not (user.settings and user.settings.email_verified):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Please verify your email first.")
        if role not in {ur.role for ur in user.roles}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Requires {role.value} role")
        return user

    return _checker
