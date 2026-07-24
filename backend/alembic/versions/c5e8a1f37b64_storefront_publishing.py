"""storefront publishing: version counter + last published timestamp

Revision ID: c5e8a1f37b64
Revises: b1d6e4f28a37
Create Date: 2026-07-20 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c5e8a1f37b64'
down_revision: Union[str, None] = 'b1d6e4f28a37'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "seller_profiles",
        sa.Column("storefront_version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "seller_profiles",
        sa.Column("last_published_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Stores published before this migration keep an honest "last published" date.
    op.execute("UPDATE seller_profiles SET last_published_at = published_at")


def downgrade() -> None:
    op.drop_column("seller_profiles", "last_published_at")
    op.drop_column("seller_profiles", "storefront_version")
