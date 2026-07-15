from pydantic import BaseModel

from app.models.enums import AccountType


class OnboardingUpdate(BaseModel):
    """Partial — every field optional so each step can autosave independently."""

    brand_name: str | None = None
    creator_name: str | None = None
    country: str | None = None
    currency: str | None = None
    account_type: AccountType | None = None


class OnboardingState(BaseModel):
    completed: bool
    brand_name: str | None = None
    creator_name: str | None = None
    country: str | None = None
    currency: str | None = None
    account_type: AccountType | None = None
