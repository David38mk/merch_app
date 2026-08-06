"""order confirmation: card display (brand/last4) + estimated delivery window

Revision ID: c8e5a1f60b92
Revises: b7d3f04e59a1
Create Date: 2026-08-05 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c8e5a1f60b92'
down_revision: Union[str, None] = 'b7d3f04e59a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("card_brand", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("card_last4", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("est_delivery_from", sa.Date(), nullable=True))
    op.add_column("orders", sa.Column("est_delivery_to", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "est_delivery_to")
    op.drop_column("orders", "est_delivery_from")
    op.drop_column("orders", "card_last4")
    op.drop_column("orders", "card_brand")
