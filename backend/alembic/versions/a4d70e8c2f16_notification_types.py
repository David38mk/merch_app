"""buyer notifications: PROMOTION + WISHLIST notification types

Revision ID: a4d70e8c2f16
Revises: f3c9a071d284
Create Date: 2026-08-05 16:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'a4d70e8c2f16'
down_revision: Union[str, None] = 'f3c9a071d284'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ADD VALUE is transaction-safe on PG 12+ (the value just can't be *used* in
    # the same tx). IF NOT EXISTS keeps re-runs idempotent.
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'PROMOTION'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'WISHLIST'")


def downgrade() -> None:
    # Postgres has no DROP VALUE for enums; leaving the labels is harmless.
    pass
