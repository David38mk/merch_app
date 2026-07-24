"""checkout: order idempotency key, shipping method, ship phone

Revision ID: b7d3f04e59a1
Revises: a4c7e91f28b6
Create Date: 2026-07-24 17:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b7d3f04e59a1'
down_revision: Union[str, None] = 'a4c7e91f28b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("idempotency_key", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("shipping_method", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("ship_phone", sa.String(), nullable=True))
    op.create_unique_constraint("uq_orders_idempotency_key", "orders", ["idempotency_key"])


def downgrade() -> None:
    op.drop_constraint("uq_orders_idempotency_key", "orders", type_="unique")
    op.drop_column("orders", "ship_phone")
    op.drop_column("orders", "shipping_method")
    op.drop_column("orders", "idempotency_key")
