"""notifications: ORDER / PAYMENT / ANNOUNCEMENT / REVIEW types

Revision ID: c6d2e9f48b31
Revises: b8e4d1f96c25
Create Date: 2026-07-22 19:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'c6d2e9f48b31'
down_revision: Union[str, None] = 'b8e4d1f96c25'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for value in ("ORDER", "PAYMENT", "ANNOUNCEMENT", "REVIEW"):
        op.execute(f"ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # Postgres enum values can't be dropped.
    pass
