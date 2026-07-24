"""order detail: QC + sent-to-provider steps, cost/placement snapshots, payout fix

Revision ID: a3f9c2e57d16
Revises: f7b3d9e24a81
Create Date: 2026-07-22 15:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a3f9c2e57d16'
down_revision: Union[str, None] = 'f7b3d9e24a81'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE fulfillmentstatus ADD VALUE IF NOT EXISTS 'QUALITY_CHECK'")
    op.execute("ALTER TYPE ordereventtype ADD VALUE IF NOT EXISTS 'SENT_TO_PROVIDER'")
    op.execute("ALTER TYPE ordereventtype ADD VALUE IF NOT EXISTS 'QUALITY_CHECK'")

    op.add_column("order_items", sa.Column("production_cost_at_purchase", sa.Numeric(10, 2), nullable=True))
    for col in ("pos_x", "pos_y", "scale", "rotation"):
        op.add_column("order_items", sa.Column(col, sa.Float(), nullable=True))

    # Backfill snapshots from the product's current values — the closest honest
    # approximation for orders that predate snapshotting.
    op.execute(
        """
        UPDATE order_items oi
        SET production_cost_at_purchase = s.production_cost,
            pos_x = s.pos_x, pos_y = s.pos_y, scale = s.scale, rotation = s.rotation
        FROM shop_items s
        WHERE s.id = oi.shop_item_id AND oi.production_cost_at_purchase IS NULL
        """
    )

    # Payout fix: earnings = subtotal − production costs − commission (what the
    # product profit calculator always promised). Recompute existing orders.
    op.execute(
        """
        UPDATE orders o
        SET seller_payout_amount = o.subtotal - o.commission_amount - COALESCE(pc.total, 0)
        FROM (
            SELECT order_id, SUM(COALESCE(production_cost_at_purchase, 0) * quantity) AS total
            FROM order_items GROUP BY order_id
        ) pc
        WHERE pc.order_id = o.id
        """
    )


def downgrade() -> None:
    for col in ("rotation", "scale", "pos_y", "pos_x", "production_cost_at_purchase"):
        op.drop_column("order_items", col)
    # Enum values can't be dropped in Postgres; payout recomputation is not reversed.
