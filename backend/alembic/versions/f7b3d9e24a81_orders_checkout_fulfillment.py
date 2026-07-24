"""orders: checkout + fulfillment — enum values, shipping fields, events, name snapshot

Revision ID: f7b3d9e24a81
Revises: e2a8f60d41c7
Create Date: 2026-07-22 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f7b3d9e24a81'
down_revision: Union[str, None] = 'e2a8f60d41c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'REFUNDED'")
    op.execute("ALTER TYPE fulfillmentstatus ADD VALUE IF NOT EXISTS 'SHIPPED'")
    op.execute("ALTER TYPE fulfillmentstatus ADD VALUE IF NOT EXISTS 'DELIVERED'")

    for col in ("ship_name", "ship_address", "ship_city", "ship_postal", "ship_country", "tracking_number"):
        op.add_column("orders", sa.Column(col, sa.String(), nullable=True))
    for col in ("shipped_at", "delivered_at", "cancelled_at", "refunded_at"):
        op.add_column("orders", sa.Column(col, sa.DateTime(timezone=True), nullable=True))

    op.add_column("order_items", sa.Column("name_at_purchase", sa.String(), nullable=True))

    op.create_table(
        "order_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("order_id", sa.Uuid(), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "PLACED", "PAID", "IN_PRODUCTION", "SHIPPED", "DELIVERED",
                "CANCELLED", "REFUNDED",
                name="ordereventtype",
            ),
            nullable=False,
        ),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_order_events_order", "order_events", ["order_id"])


def downgrade() -> None:
    op.drop_index("ix_order_events_order", table_name="order_events")
    op.drop_table("order_events")
    op.execute("DROP TYPE IF EXISTS ordereventtype")
    op.drop_column("order_items", "name_at_purchase")
    for col in ("refunded_at", "cancelled_at", "delivered_at", "shipped_at",
                "tracking_number", "ship_country", "ship_postal", "ship_city",
                "ship_address", "ship_name"):
        op.drop_column("orders", col)
