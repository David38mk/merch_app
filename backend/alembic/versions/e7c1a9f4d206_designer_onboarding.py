"""designer onboarding: profile fields + portfolio items

Revision ID: e7c1a9f4d206
Revises: c6f2a3901e58
Create Date: 2026-08-05 19:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e7c1a9f4d206'
down_revision: Union[str, None] = 'c6f2a3901e58'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("designer_profiles", sa.Column("country", sa.String(), nullable=True))
    op.add_column("designer_profiles", sa.Column("experience", sa.String(), nullable=True))
    op.add_column("designer_profiles", sa.Column("skills", sa.JSON(), server_default=sa.text("'[]'"), nullable=False))
    op.add_column("designer_profiles", sa.Column("portfolio_links", sa.JSON(), server_default=sa.text("'[]'"), nullable=False))
    op.add_column("designer_profiles", sa.Column("onboarding_completed_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "designer_portfolio_items",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("designer_profile_id", sa.Uuid(), nullable=False),
        sa.Column("image_url", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["designer_profile_id"], ["designer_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_designer_portfolio_items_designer_profile_id", "designer_portfolio_items", ["designer_profile_id"])


def downgrade() -> None:
    op.drop_index("ix_designer_portfolio_items_designer_profile_id", table_name="designer_portfolio_items")
    op.drop_table("designer_portfolio_items")
    op.drop_column("designer_profiles", "onboarding_completed_at")
    op.drop_column("designer_profiles", "portfolio_links")
    op.drop_column("designer_profiles", "skills")
    op.drop_column("designer_profiles", "experience")
    op.drop_column("designer_profiles", "country")
