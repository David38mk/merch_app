"""Account settings: personal info, business info, preferences, security.

Brand/storefront fields (name, URL, socials, assets) are surfaced read-only with
links into the website builder — editing them here would bypass the builder's
draft-until-published contract (the exact bug class fixed in the onboarding
router). Sensitive changes (email, password) require the current password, and
both password change and "log out everywhere" advance `sessions_revoked_at`.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, oauth2_scheme
from app.core.config import settings as app_settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_verify_token,
    decode_access_payload,
    hash_password,
    validate_password_strength,
    verify_password,
)
from app.models.enums import AddressType
from app.models.user import Address, SellerProfile, Settings, User
from app.seams.delivery import send_verification
from app.seams.storage import StorageError, delete_image, save_image

router = APIRouter(prefix="/settings", tags=["settings"])


# ── schemas ──────────────────────────────────────────────────────────────────

class PersonalOut(BaseModel):
    first_name: str
    last_name: str
    display_name: str
    email: str
    phone: str | None
    avatar_url: str | None
    email_verified: bool


class BusinessOut(BaseModel):
    brand_name: str | None  # read-only here — edited in the website builder
    tax_id: str | None
    country: str | None
    currency: str | None


class StoreOut(BaseModel):
    slug: str | None
    is_published: bool


class PreferencesOut(BaseModel):
    language: str
    currency: str
    timezone: str | None
    email_notifications: bool
    marketing_emails: bool


class SecurityOut(BaseModel):
    has_password: bool
    connected_google: bool
    session_started: datetime | None  # when THIS token was issued
    sessions_revoked_at: datetime | None


class AccountOut(BaseModel):
    personal: PersonalOut
    business: BusinessOut
    store: StoreOut
    preferences: PreferencesOut
    security: SecurityOut


class ProfilePatch(BaseModel):
    first_name: str | None = Field(default=None, min_length=1)
    last_name: str | None = Field(default=None, min_length=1)
    phone: str | None = None  # "" clears it


class BusinessPatch(BaseModel):
    tax_id: str | None = None
    country: str | None = None
    currency: str | None = None


class PreferencesPatch(BaseModel):
    language: str | None = None
    currency: str | None = None
    timezone: str | None = None
    email_notifications: bool | None = None
    marketing_emails: bool | None = None


class PasswordChange(BaseModel):
    current_password: str | None = None  # not required for OAuth-only accounts
    new_password: str


class EmailChange(BaseModel):
    new_email: EmailStr
    current_password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── helpers ──────────────────────────────────────────────────────────────────

def _ensure_settings(db: Session, user: User) -> Settings:
    if user.settings is None:
        user.settings = Settings()
        db.add(user.settings)
        db.flush()
    return user.settings


def _seller(db: Session, user: User) -> SellerProfile | None:
    return db.scalar(select(SellerProfile).where(SellerProfile.user_id == user.id))


def _account(db: Session, user: User, token: str | None = None) -> AccountOut:
    s = _ensure_settings(db, user)
    p = _seller(db, user)
    issued = None
    if token:
        payload = decode_access_payload(token)
        if payload and payload.get("iat"):
            issued = datetime.fromtimestamp(payload["iat"], tz=timezone.utc)
    return AccountOut(
        personal=PersonalOut(
            first_name=user.first_name,
            last_name=user.last_name,
            display_name=user.display_name,
            email=user.email,
            phone=user.phone,
            avatar_url=user.avatar_url,
            email_verified=bool(s.email_verified),
        ),
        business=BusinessOut(
            brand_name=p.store_name if p else None,
            tax_id=p.tax_id if p else None,
            country=p.country if p else None,
            currency=p.currency if p else None,
        ),
        store=StoreOut(
            slug=p.slug if p else None,
            is_published=bool(p and p.published_at and p.store_state.value == "LIVE"),
        ),
        preferences=PreferencesOut(
            language=s.language,
            currency=s.currency,
            timezone=s.timezone,
            email_notifications=s.notifications_enabled,
            marketing_emails=s.receive_newsletters,
        ),
        security=SecurityOut(
            has_password=bool(user.password_hash),
            connected_google=user.auth_provider == "google",
            session_started=issued,
            sessions_revoked_at=user.sessions_revoked_at,
        ),
    )


# ── read ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=AccountOut)
def get_account(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AccountOut:
    return _account(db, user, token)


# ── personal ─────────────────────────────────────────────────────────────────

@router.patch("/profile", response_model=AccountOut)
def update_profile(
    payload: ProfilePatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AccountOut:
    if payload.first_name is not None:
        user.first_name = payload.first_name.strip()
    if payload.last_name is not None:
        user.last_name = payload.last_name.strip()
    if payload.phone is not None:
        user.phone = payload.phone.strip() or None
    user.display_name = f"{user.first_name} {user.last_name}".strip() or user.display_name
    db.commit()
    return _account(db, user)


@router.post("/avatar", response_model=AccountOut)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AccountOut:
    data = await file.read()
    try:
        url = save_image(data, file.content_type, max_px=app_settings.LOGO_MAX_PX)
    except StorageError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    old = user.avatar_url
    user.avatar_url = url
    db.commit()
    if old:
        delete_image(old)
    return _account(db, user)


@router.delete("/avatar", response_model=AccountOut)
def remove_avatar(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AccountOut:
    old = user.avatar_url
    user.avatar_url = None
    db.commit()
    if old:
        delete_image(old)
    return _account(db, user)


# ── business + preferences (take effect immediately) ─────────────────────────

@router.patch("/business", response_model=AccountOut)
def update_business(
    payload: BusinessPatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AccountOut:
    p = _seller(db, user)
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No seller profile.")
    if payload.tax_id is not None:
        p.tax_id = payload.tax_id.strip() or None
    if payload.country is not None:
        p.country = payload.country.strip() or None
    if payload.currency is not None:
        p.currency = payload.currency.strip().upper() or None
    db.commit()
    return _account(db, user)


@router.patch("/preferences", response_model=AccountOut)
def update_preferences(
    payload: PreferencesPatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AccountOut:
    s = _ensure_settings(db, user)
    if payload.language is not None:
        s.language = payload.language
    if payload.currency is not None:
        s.currency = payload.currency.strip().upper() or "EUR"
    if payload.timezone is not None:
        s.timezone = payload.timezone or None
    if payload.email_notifications is not None:
        s.notifications_enabled = payload.email_notifications
    if payload.marketing_emails is not None:
        s.receive_newsletters = payload.marketing_emails
    db.commit()
    return _account(db, user)


# ── security (sensitive: password-confirmed) ─────────────────────────────────

@router.post("/password", response_model=TokenOut)
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TokenOut:
    """Change (or, for Google-only accounts, set) the password. All other
    sessions are logged out; a fresh token keeps this device signed in."""
    if user.password_hash:
        if not payload.current_password or not verify_password(payload.current_password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    try:
        validate_password_strength(payload.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    user.password_hash = hash_password(payload.new_password)
    user.sessions_revoked_at = datetime.now(timezone.utc)
    db.commit()
    return TokenOut(access_token=create_access_token(str(user.id)))


@router.post("/email", response_model=AccountOut)
def change_email(
    payload: EmailChange,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AccountOut:
    if user.auth_provider == "google":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account signs in with Google — its email is managed there.",
        )
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    new_email = payload.new_email.lower()
    if new_email == user.email:
        return _account(db, user)
    if db.scalar(select(User).where(User.email == new_email)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That email is already in use.")

    user.email = new_email
    s = _ensure_settings(db, user)
    s.email_verified = False  # the new address must prove itself
    verify_url = f"{app_settings.FRONTEND_ORIGIN}/verify-email?token={create_verify_token(str(user.id))}"
    send_verification(new_email, verify_url)  # 🔌 email seam (stub logs the link)
    db.commit()
    return _account(db, user)


@router.post("/logout-all", response_model=TokenOut)
def logout_everywhere(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TokenOut:
    """Kill every issued token (stolen-laptop button); this device gets a fresh one."""
    user.sessions_revoked_at = datetime.now(timezone.utc)
    db.commit()
    return TokenOut(access_token=create_access_token(str(user.id)))


# ── saved addresses ───────────────────────────────────────────────────────────

class AddressOut(BaseModel):
    id: uuid.UUID
    address_type: AddressType
    is_default: bool
    full_name: str
    phone: str | None
    line1: str
    line2: str | None
    city: str
    region: str | None
    postal_code: str
    country: str


class AddressIn(BaseModel):
    address_type: AddressType
    is_default: bool = False
    # Also save a mirror-type copy (a Shipping create with this on adds a Billing
    # twin) — the "use for both" toggle. Only meaningful on create.
    use_for_both: bool = False
    full_name: str = Field(min_length=1)
    phone: str | None = None
    line1: str = Field(min_length=1)
    line2: str | None = None
    city: str = Field(min_length=1)
    region: str | None = None
    postal_code: str = Field(min_length=1)
    country: str = Field(min_length=1)


class AddressPatch(BaseModel):
    address_type: AddressType | None = None
    is_default: bool | None = None
    full_name: str | None = Field(default=None, min_length=1)
    phone: str | None = None
    line1: str | None = Field(default=None, min_length=1)
    line2: str | None = None
    city: str | None = Field(default=None, min_length=1)
    region: str | None = None
    postal_code: str | None = Field(default=None, min_length=1)
    country: str | None = Field(default=None, min_length=1)


def _addr_out(a: Address) -> AddressOut:
    return AddressOut(
        id=a.id, address_type=a.address_type, is_default=a.is_default,
        full_name=a.full_name, phone=a.phone, line1=a.line1, line2=a.line2,
        city=a.city, region=a.region, postal_code=a.postal_code, country=a.country,
    )


def _clear_defaults(db: Session, user_id: uuid.UUID, kind: AddressType, keep: uuid.UUID | None = None) -> None:
    """At most one default per type — demote the others before promoting one."""
    rows = db.scalars(
        select(Address).where(
            Address.user_id == user_id, Address.address_type == kind, Address.is_default.is_(True)
        )
    ).all()
    for r in rows:
        if r.id != keep:
            r.is_default = False


def _list_addresses(db: Session, user: User) -> list[AddressOut]:
    rows = db.scalars(
        select(Address)
        .where(Address.user_id == user.id)
        .order_by(Address.address_type, Address.is_default.desc(), Address.created_at.desc())
    ).all()
    return [_addr_out(a) for a in rows]


def _fields(payload: AddressIn) -> dict:
    return dict(
        full_name=payload.full_name.strip(), phone=(payload.phone or "").strip() or None,
        line1=payload.line1.strip(), line2=(payload.line2 or "").strip() or None,
        city=payload.city.strip(), region=(payload.region or "").strip() or None,
        postal_code=payload.postal_code.strip(), country=payload.country.strip(),
    )


@router.get("/addresses", response_model=list[AddressOut])
def list_addresses(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[AddressOut]:
    return _list_addresses(db, user)


@router.post("/addresses", response_model=list[AddressOut], status_code=status.HTTP_201_CREATED)
def create_address(
    payload: AddressIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[AddressOut]:
    kinds = [payload.address_type]
    if payload.use_for_both:
        other = AddressType.BILLING if payload.address_type == AddressType.SHIPPING else AddressType.SHIPPING
        kinds.append(other)
    for kind in kinds:
        if payload.is_default:
            _clear_defaults(db, user.id, kind)
        db.add(Address(user_id=user.id, address_type=kind, is_default=payload.is_default, **_fields(payload)))
    db.commit()
    return _list_addresses(db, user)


def _own_address(db: Session, user: User, address_id: uuid.UUID) -> Address:
    a = db.get(Address, address_id)
    if a is None or a.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found.")
    return a


@router.patch("/addresses/{address_id}", response_model=list[AddressOut])
def update_address(
    address_id: uuid.UUID,
    payload: AddressPatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[AddressOut]:
    a = _own_address(db, user, address_id)
    if payload.address_type is not None:
        a.address_type = payload.address_type
    for attr in ("full_name", "line1", "city", "postal_code", "country"):
        val = getattr(payload, attr)
        if val is not None:
            setattr(a, attr, val.strip())
    for attr in ("phone", "line2", "region"):
        val = getattr(payload, attr)
        if val is not None:
            setattr(a, attr, val.strip() or None)
    if payload.is_default is not None:
        a.is_default = payload.is_default
        if payload.is_default:
            _clear_defaults(db, user.id, a.address_type, keep=a.id)
    db.commit()
    return _list_addresses(db, user)


@router.delete("/addresses/{address_id}", response_model=list[AddressOut])
def delete_address(
    address_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[AddressOut]:
    a = _own_address(db, user, address_id)
    db.delete(a)
    db.commit()
    return _list_addresses(db, user)
