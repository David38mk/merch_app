from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App configuration, loaded from environment / .env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql://mhc:mhc_dev_password@localhost:5432/myhappinessclub"
    SECRET_KEY: str = "dev-only-change-me"
    ALGORITHM: str = "HS256"
    FRONTEND_ORIGIN: str = "http://localhost:5173"

    # In DEBUG, forgot-password / verify responses include the dev link so the
    # flow is testable without a real email provider. Never leave on in prod.
    DEBUG: bool = True

    # Token lifetimes (minutes)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day (no "remember me")
    REMEMBER_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 days ("remember me")
    RESET_TOKEN_EXPIRE_MINUTES: int = 30
    VERIFY_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # Google Sign-In — paste your OAuth Web Client ID here to enable it.
    # Empty = Google button stays disabled ("configure Google").
    GOOGLE_CLIENT_ID: str = ""

    # Require email verification before login/onboarding. Off = fewest steps.
    EMAIL_VERIFICATION_ENABLED: bool = False

    # 🔌 File/image storage seam. MVP stores uploads on local disk and serves
    # them at /uploads; swap the storage seam for S3/Cloudinary later.
    UPLOAD_DIR: str = "uploads"
    UPLOAD_URL_PREFIX: str = "/uploads"
    MAX_UPLOAD_MB: int = 5
    # Longest edge each image is downscaled to (keeps files small — the "optimize" step).
    LOGO_MAX_PX: int = 512
    COVER_MAX_PX: int = 1600


settings = Settings()
