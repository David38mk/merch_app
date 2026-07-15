"""Placeholder routers — the remaining MVP surface, scaffolded but not implemented.
Each maps to a section of MVP-SCOPE.md. Fill these in following catalog.py's pattern.
`routers` is collected by app/api/routers/__init__.py.
"""

from fastapi import APIRouter

shop_items = APIRouter(prefix="/shop-items", tags=["shop-items"])
designer_calls = APIRouter(prefix="/designer-calls", tags=["hiring"])
collaborations = APIRouter(prefix="/collaborations", tags=["hiring"])
orders = APIRouter(prefix="/orders", tags=["commerce"])
production = APIRouter(prefix="/production", tags=["printshop"])


@shop_items.get("")
def list_shop_items() -> dict:
    # TODO: seller CRUD + "Design now" (upload/AI-stub) + list/unlist. See MVP-SCOPE › Seller.
    return {"todo": "shop items: create via Design-now, list/unlist, storefront reads"}


@designer_calls.get("")
def list_designer_calls() -> dict:
    # TODO: seller posts calls; designers browse + submit Bids; seller accepts one → Collaboration.
    return {"todo": "designer calls + bids (bidding model)"}


@collaborations.get("")
def list_collaborations() -> dict:
    # TODO: collab state machine (pending→preview→…→completed), submissions, feedback, chat (polled).
    return {"todo": "collaboration state machine + chat"}


@orders.get("")
def list_orders() -> dict:
    # TODO: cart → checkout (stubbed gateway) → Order (plan-based commission) → buyer history.
    return {"todo": "cart, checkout (payment seam), orders + commission"}


@production.get("/queue")
def production_queue() -> dict:
    # TODO: OrderItems where print_shop = me and fulfillment < HANDED_TO_SHIPMENT; advance status.
    return {"todo": "printshop production queue (paid→in_production→handed_to_shipment)"}


routers = [shop_items, designer_calls, collaborations, orders, production]
