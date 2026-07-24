"""catalog image_url + favorites

Revision ID: d4e8b2a90c15
Revises: c9f4a1b7d3e2
Create Date: 2026-07-15 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd4e8b2a90c15'
down_revision: Union[str, None] = 'c9f4a1b7d3e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("base_items", sa.Column("image_url", sa.String(), nullable=True))

    op.create_table(
        "catalog_favorites",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("base_item_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["base_item_id"], ["base_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "base_item_id", name="uq_catalog_favorite"),
    )
    op.create_index("ix_catalog_favorites_user_id", "catalog_favorites", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_catalog_favorites_user_id", table_name="catalog_favorites")
    op.drop_table("catalog_favorites")
    op.drop_column("base_items", "image_url")
