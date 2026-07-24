"""buyer accounts: terms acceptance timestamp

Revision ID: e9f2b7c4a10d
Revises: d7e1f5a83c92
Create Date: 2026-07-24 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e9f2b7c4a10d'
down_revision: Union[str, None] = 'd7e1f5a83c92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("accepted_terms_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "accepted_terms_at")
