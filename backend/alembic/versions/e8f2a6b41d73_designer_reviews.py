"""designer reviews

Revision ID: e8f2a6b41d73
Revises: c3b9f4d27e15
Create Date: 2026-07-15 18:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e8f2a6b41d73'
down_revision: Union[str, None] = 'c3b9f4d27e15'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "designer_reviews",
        sa.Column("designer_profile_id", sa.Uuid(), nullable=False),
        sa.Column("seller_profile_id", sa.Uuid(), nullable=True),
        sa.Column("collab_id", sa.Uuid(), nullable=True),
        sa.Column("reviewer_name", sa.String(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.String(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["designer_profile_id"], ["designer_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["seller_profile_id"], ["seller_profiles.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["collab_id"], ["collaborations.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_designer_reviews_designer_profile_id", "designer_reviews", ["designer_profile_id"])


def downgrade() -> None:
    op.drop_index("ix_designer_reviews_designer_profile_id", table_name="designer_reviews")
    op.drop_table("designer_reviews")
