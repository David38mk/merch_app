from pydantic import BaseModel


class ChecklistFlags(BaseModel):
    complete_profile: bool
    upload_logo: bool
    create_product: bool
    publish_product: bool
    publish_store: bool


class StorefrontMini(BaseModel):
    is_published: bool
    slug: str | None = None
    store_name: str | None = None
    has_logo: bool = False


class DashboardStats(BaseModel):
    products: int = 0
    live_products: int = 0
    orders: int = 0
    ai_credits: int = 0
    currency: str | None = None


class SellerDashboard(BaseModel):
    first_name: str
    display_name: str
    checklist: ChecklistFlags
    steps_done: int
    steps_total: int
    is_active: bool  # all steps done → dashboard shifts from setup to business overview
    storefront: StorefrontMini
    stats: DashboardStats
