"""designer portfolio projects + project images

Revision ID: a9d4f2016c73
Revises: f8a2d0c53b41
Create Date: 2026-08-06 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a9d4f2016c73'
down_revision: Union[str, None] = 'f8a2d0c53b41'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "designer_projects",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("designer_profile_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("categories", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("featured", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("published", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["designer_profile_id"], ["designer_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_designer_projects_designer_profile_id"),
        "designer_projects", ["designer_profile_id"],
    )
    op.create_table(
        "designer_project_images",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("image_url", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["designer_projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_designer_project_images_project_id"),
        "designer_project_images", ["project_id"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_designer_project_images_project_id"), table_name="designer_project_images")
    op.drop_table("designer_project_images")
    op.drop_index(op.f("ix_designer_projects_designer_profile_id"), table_name="designer_projects")
    op.drop_table("designer_projects")
