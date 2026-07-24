"""product editor: persist variant/options on shop items + revision history

Revision ID: e2a8f60d41c7
Revises: d9c4b7e15a30
Create Date: 2026-07-20 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e2a8f60d41c7'
down_revision: Union[str, None] = 'd9c4b7e15a30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for col in ("color", "size", "material", "print_type"):
        op.add_column("shop_items", sa.Column(col, sa.String(), nullable=True))

    # Products created before this migration only kept a cost snapshot. Backfill
    # the variant from the blank's first available combo so the editor opens on a
    # real selection instead of an empty one; production_cost is left untouched.
    op.execute(
        """
        UPDATE shop_items s
        SET color = v.color, size = v.size
        FROM base_item_variants v
        WHERE v.id = (
            SELECT v2.id FROM base_item_variants v2
            WHERE v2.base_item_id = s.base_item_id AND v2.is_available
            ORDER BY v2.color, v2.size
            LIMIT 1
        )
        """
    )

    op.create_table(
        "shop_item_revisions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("shop_item_id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("summary", sa.JSON(), nullable=False),
        sa.Column("before", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["shop_item_id"], ["shop_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_shop_item_revisions_item", "shop_item_revisions", ["shop_item_id"])


def downgrade() -> None:
    op.drop_index("ix_shop_item_revisions_item", table_name="shop_item_revisions")
    op.drop_table("shop_item_revisions")
    for col in ("print_type", "material", "size", "color"):
        op.drop_column("shop_items", col)
