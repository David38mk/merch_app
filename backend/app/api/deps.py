import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.enums import Role
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

_credentials_exc = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    subject = decode_access_token(token)
    if subject is None:
        raise _credentials_exc
    try:
        user_id = uuid.UUID(subject)
    except ValueError:
        raise _credentials_exc
    user = db.get(User, user_id)
    if user is None:
        raise _credentials_exc
    return user


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
