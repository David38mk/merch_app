from fastapi import APIRouter

from app.api.routers import (
    account,
    analytics,
    auth,
    cart,
    catalog,
    collaborations,
    designers,
    designs,
    hiring,
    marketplace,
    notifications,
    onboarding,
    orders,
    public_store,
    seller_dashboard,
    shop_items,
    storefront,
    stubs,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(account.router)
api_router.include_router(cart.router)
api_router.include_router(catalog.router)
api_router.include_router(onboarding.router)
api_router.include_router(storefront.router)
api_router.include_router(public_store.router)
api_router.include_router(marketplace.router)
api_router.include_router(seller_dashboard.router)
api_router.include_router(analytics.router)
api_router.include_router(notifications.router)
api_router.include_router(designs.router)
api_router.include_router(shop_items.router)
api_router.include_router(hiring.router)
api_router.include_router(designers.router)
api_router.include_router(designers.public_router)
api_router.include_router(collaborations.router)
for r in orders.routers:
    api_router.include_router(r)
for stub in stubs.routers:
    api_router.include_router(stub)
