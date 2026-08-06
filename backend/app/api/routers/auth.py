from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Form, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.google import google_enabled, verify_google_credential
from app.core.notify import seed_welcome
from app.core.security import (
    create_access_token,
    create_reset_token,
    create_verify_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.enums import Role
from app.models.user import Settings, User, UserRole
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    GoogleAuthRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    Token,
    UserPublic,
    VerifyEmailRequest,
)
from app.seams.delivery import send_password_reset, send_verification

router = APIRouter(prefix="/auth", tags=["auth"])


# ── helpers ──────────────────────────────────────────────────────────────────

def _roles_for(intent: str) -> tuple[Role, ...]:
    """Buyer signup → a pure Buyer; seller signup → Buyer + Seller."""
    return (Role.BUYER,) if intent == "buyer" else (Role.BUYER, Role.SELLER)


def _account(roles: tuple[Role, ...], **kwargs) -> User:
    user = User(**kwargs)
    for role in roles:
        user.roles.append(UserRole(role=role))
    return user


def _find_by_email(db: Session, email: str) -> User | None:
    """Case-insensitive lookup — guest checkouts store lowercased emails, and
    users don't remember the casing they signed up with."""
    return db.scalar(select(User).where(func.lower(User.email) == email.strip().lower()))


def _is_verified(user: User) -> bool:
    return bool(user.settings and user.settings.email_verified)


def _to_public(user: User) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        display_name=user.display_name,
        roles=[ur.role for ur in user.roles],
        email_verified=_is_verified(user),
    )


def _verify_link(user: User) -> str:
    return f"{settings.FRONTEND_ORIGIN}/verify-email?token={create_verify_token(str(user.id))}"


# ── register / login ─────────────────────────────────────────────────────────

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> Token:
    now = datetime.now(timezone.utc)
    roles = _roles_for(payload.intent)
    display = f"{payload.first_name} {payload.last_name}".strip()

    existing = _find_by_email(db, payload.email)
    if existing is not None:
        # A guest who checked out (passwordless, no OAuth) is claiming their
        # account: set a password and keep the order history already tied to it.
        # A real account (has a password or a linked provider) is a hard conflict.
        if existing.password_hash is not None or existing.auth_provider is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists."
            )
        existing.password_hash = hash_password(payload.password)
        existing.first_name = payload.first_name
        existing.last_name = payload.last_name
        existing.display_name = display
        existing.accepted_terms_at = now
        have = {ur.role for ur in existing.roles}
        for role in roles:
            if role not in have:
                existing.roles.append(UserRole(role=role))
        if existing.settings is None:
            existing.settings = Settings(email_verified=False)
        db.flush()
        seed_welcome(db, existing)  # a guest had no welcome notifications
        db.commit()
        db.refresh(existing)
        if settings.EMAIL_VERIFICATION_ENABLED:
            send_verification(existing.email, _verify_link(existing))
        return Token(
            access_token=create_access_token(str(existing.id)),
            email_verification_required=settings.EMAIL_VERIFICATION_ENABLED,
        )

    user = _account(
        roles,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        display_name=display,
        accepted_terms_at=now,
    )
    user.settings = Settings(email_verified=False)
    db.add(user)
    db.flush()  # assign user.id so we can attach notifications in the same transaction
    seed_welcome(db, user)
    try:
        db.commit()
    except IntegrityError:  # lost a concurrent race on the unique email
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")
    db.refresh(user)

    if settings.EMAIL_VERIFICATION_ENABLED:
        send_verification(user.email, _verify_link(user))

    return Token(
        access_token=create_access_token(str(user.id)),
        email_verification_required=settings.EMAIL_VERIFICATION_ENABLED,
    )


@router.post("/login", response_model=Token)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    remember: bool = Form(False),
    db: Session = Depends(get_db),
) -> Token:
    user = _find_by_email(db, form.username)
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password.")
    if user.deactivated_at is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been closed.")
    if settings.EMAIL_VERIFICATION_ENABLED and not _is_verified(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Please verify your email first.")
    return Token(access_token=create_access_token(str(user.id), remember=remember))


@router.get("/me", response_model=UserPublic)
def me(user: User = Depends(get_current_user)) -> UserPublic:
    return _to_public(user)


# ── Google ───────────────────────────────────────────────────────────────────

@router.get("/google/config")
def google_config() -> dict:
    """Frontend uses this to decide whether to render the Google button."""
    return {"enabled": google_enabled(), "client_id": settings.GOOGLE_CLIENT_ID}


@router.post("/google", response_model=Token)
def google_login(payload: GoogleAuthRequest, db: Session = Depends(get_db)) -> Token:
    try:
        info = verify_google_credential(payload.credential)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    email = info["email"]
    user = _find_by_email(db, email)
    if user is not None and user.deactivated_at is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been closed.")
    if user is None:
        first = info.get("given_name") or (info.get("name") or email).split(" ")[0]
        last = info.get("family_name") or ""
        user = _account(
            _roles_for(payload.intent),
            email=email.lower(),
            password_hash=None,  # OAuth-only account
            first_name=first,
            last_name=last,
            display_name=info.get("name") or f"{first} {last}".strip(),
            auth_provider="google",
            avatar_url=info.get("picture"),
            accepted_terms_at=datetime.now(timezone.utc),  # accepted via the Google consent flow
        )
        user.settings = Settings(email_verified=True)  # Google emails are pre-verified
        db.add(user)
        db.flush()
        seed_welcome(db, user)
        db.commit()
        db.refresh(user)
    elif user.auth_provider is None and user.password_hash is None:
        # A guest checkout account signing in with Google for the first time —
        # link the provider and pre-verify, keeping their existing orders.
        user.auth_provider = "google"
        if user.accepted_terms_at is None:
            user.accepted_terms_at = datetime.now(timezone.utc)
        if user.settings is None:
            user.settings = Settings(email_verified=True)
        else:
            user.settings.email_verified = True
        if Role.BUYER not in {ur.role for ur in user.roles}:
            user.roles.append(UserRole(role=Role.BUYER))
        db.flush()
        seed_welcome(db, user)
        db.commit()
        db.refresh(user)

    return Token(access_token=create_access_token(str(user.id), remember=payload.remember))


# ── password reset ───────────────────────────────────────────────────────────

@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> ForgotPasswordResponse:
    user = _find_by_email(db, payload.email)
    dev_url: str | None = None
    if user is not None:
        reset_url = f"{settings.FRONTEND_ORIGIN}/reset-password?token={create_reset_token(str(user.id))}"
        send_password_reset(user.email, reset_url)
        if settings.DEBUG:  # dev convenience — email is stubbed
            dev_url = reset_url
    return ForgotPasswordResponse(dev_reset_url=dev_url)


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> dict:
    subject = decode_token(payload.token, "reset")
    if subject is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link.")
    user = db.get(User, subject)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link.")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"detail": "Password updated. You can now log in."}


# ── email verification ───────────────────────────────────────────────────────

@router.post("/verify-email")
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)) -> dict:
    subject = decode_token(payload.token, "verify")
    if subject is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification link.")
    user = db.get(User, subject)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification link.")
    if user.settings is None:
        user.settings = Settings()
    user.settings.email_verified = True
    db.commit()
    return {"detail": "Email verified. You're all set."}


@router.post("/resend-verification")
def resend_verification(payload: ResendVerificationRequest, db: Session = Depends(get_db)) -> dict:
    user = _find_by_email(db, payload.email)
    if user is not None and not _is_verified(user):
        send_verification(user.email, _verify_link(user))
    return {"detail": "If that email needs verification, a link has been sent."}
