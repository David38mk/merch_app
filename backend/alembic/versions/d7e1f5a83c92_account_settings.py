"""account settings: session revocation, timezone preference, tax id

Revision ID: d7e1f5a83c92
Revises: c6d2e9f48b31
Create Date: 2026-07-22 21:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd7e1f5a83c92'
down_revision: Union[str, None] = 'c6d2e9f48b31'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("sessions_revoked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("settings", sa.Column("timezone", sa.String(), nullable=True))
    op.add_column("seller_profiles", sa.Column("tax_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("seller_profiles", "tax_id")
    op.drop_column("settings", "timezone")
    op.drop_column("users", "sessions_revoked_at")
