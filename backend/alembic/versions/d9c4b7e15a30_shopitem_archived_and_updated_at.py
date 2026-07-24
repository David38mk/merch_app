"""product management: ARCHIVED state + updated_at on shop items

Revision ID: d9c4b7e15a30
Revises: c5e8a1f37b64
Create Date: 2026-07-20 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd9c4b7e15a30'
down_revision: Union[str, None] = 'c5e8a1f37b64'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres ≥12 allows ADD VALUE inside a transaction as long as the new value
    # isn't *used* in the same one — we only add the column here.
    op.execute("ALTER TYPE shopitemstate ADD VALUE IF NOT EXISTS 'ARCHIVED'")
    op.add_column(
        "shop_items",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    # Existing rows have never been edited — created is the honest "last updated".
    op.execute("UPDATE shop_items SET updated_at = created_at")


def downgrade() -> None:
    # Enum values can't be dropped in Postgres; archived rows would have to be
    # migrated to UNLISTED by hand before recreating the type.
    op.drop_column("shop_items", "updated_at")
