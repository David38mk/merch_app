"""base_item production_time

Revision ID: f1a3c7e920d8
Revises: d4e8b2a90c15
Create Date: 2026-07-15 11:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f1a3c7e920d8'
down_revision: Union[str, None] = 'd4e8b2a90c15'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("base_items", sa.Column("production_time", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("base_items", "production_time")
