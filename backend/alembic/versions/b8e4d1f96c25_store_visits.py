"""analytics: store visits (unique visitor per storefront per day)

Revision ID: b8e4d1f96c25
Revises: a3f9c2e57d16
Create Date: 2026-07-22 17:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b8e4d1f96c25'
down_revision: Union[str, None] = 'a3f9c2e57d16'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "store_visits",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("seller_profile_id", sa.Uuid(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("ip_hash", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["seller_profile_id"], ["seller_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("seller_profile_id", "day", "ip_hash", name="uq_visit"),
    )
    op.create_index("ix_store_visits_seller_day", "store_visits", ["seller_profile_id", "day"])


def downgrade() -> None:
    op.drop_index("ix_store_visits_seller_day", table_name="store_visits")
    op.drop_table("store_visits")
