"""shop_item rotation + tags

Revision ID: b6c2f81ad470
Revises: f1a3c7e920d8
Create Date: 2026-07-15 13:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b6c2f81ad470'
down_revision: Union[str, None] = 'f1a3c7e920d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("shop_items", sa.Column("rotation", sa.Float(), server_default="0", nullable=False))
    op.add_column("shop_items", sa.Column("tags", sa.String(), nullable=True))
    op.add_column(
        "shop_items",
        sa.Column("production_cost", sa.Numeric(precision=10, scale=2), server_default="0", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("shop_items", "production_cost")
    op.drop_column("shop_items", "tags")
    op.drop_column("shop_items", "rotation")
