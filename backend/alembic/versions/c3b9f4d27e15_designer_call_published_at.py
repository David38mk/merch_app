"""designer_call published_at

Revision ID: c3b9f4d27e15
Revises: a7d5e3c81b92
Create Date: 2026-07-15 16:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c3b9f4d27e15'
down_revision: Union[str, None] = 'a7d5e3c81b92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("designer_calls", sa.Column("published_at", sa.DateTime(timezone=True), nullable=True))
    # Backfill already-published jobs so the hub shows a publish date.
    op.execute("UPDATE designer_calls SET published_at = created_at WHERE status = 'OPEN' AND published_at IS NULL")


def downgrade() -> None:
    op.drop_column("designer_calls", "published_at")
