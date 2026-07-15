from fastapi import APIRouter

from app.api.routers import (
    auth,
    catalog,
    notifications,
    onboarding,
    public_store,
    seller_dashboard,
    storefront,
    stubs,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(catalog.router)
api_router.include_router(onboarding.router)
api_router.include_router(storefront.router)
api_router.include_router(public_store.router)
api_router.include_router(seller_dashboard.router)
api_router.include_router(notifications.router)
for stub in stubs.routers:
    api_router.include_router(stub)
