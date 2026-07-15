import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.security import validate_password_strength
from app.models.enums import Role


def _check_password(v: str) -> str:
    validate_password_strength(v)  # raises ValueError → 422 with a clear message
    return v


class RegisterRequest(BaseModel):
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    email: EmailStr
    password: str

    _pw = field_validator("password")(_check_password)


class GoogleAuthRequest(BaseModel):
    credential: str  # the Google ID token returned by Google Identity Services
    remember: bool = False


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    _pw = field_validator("new_password")(_check_password)


class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email_verification_required: bool = False


class ForgotPasswordResponse(BaseModel):
    # Always the same message (don't leak whether an email exists).
    detail: str = "If that email exists, a reset link has been sent."
    # DEBUG-only convenience so the flow is testable without a real email provider.
    dev_reset_url: str | None = None


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    first_name: str
    last_name: str
    display_name: str
    roles: list[Role] = []
    email_verified: bool = False
