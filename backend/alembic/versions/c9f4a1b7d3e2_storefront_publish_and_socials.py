"""storefront publish + social platforms

Revision ID: c9f4a1b7d3e2
Revises: e7db97983a51
Create Date: 2026-07-14 13:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c9f4a1b7d3e2'
down_revision: Union[str, None] = 'e7db97983a51'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # When the storefront first went live.
    op.add_column(
        "seller_profiles",
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    # New social platforms for the brand editor. ADD VALUE runs in a transaction on
    # PG 12+; IF NOT EXISTS keeps this migration re-runnable.
    op.execute("ALTER TYPE socialplatform ADD VALUE IF NOT EXISTS 'FACEBOOK'")
    op.execute("ALTER TYPE socialplatform ADD VALUE IF NOT EXISTS 'WEBSITE'")


def downgrade() -> None:
    op.drop_column("seller_profiles", "published_at")
    # Postgres has no DROP VALUE for an enum; FACEBOOK/WEBSITE remain on the type.
