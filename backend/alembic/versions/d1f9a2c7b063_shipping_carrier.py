"""order tracking: shipping carrier

Revision ID: d1f9a2c7b063
Revises: c8e5a1f60b92
Create Date: 2026-08-05 13:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd1f9a2c7b063'
down_revision: Union[str, None] = 'c8e5a1f60b92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("shipping_carrier", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "shipping_carrier")
