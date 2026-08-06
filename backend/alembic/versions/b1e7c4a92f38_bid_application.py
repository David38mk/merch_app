"""job application: bid intro + attached portfolio projects

Revision ID: b1e7c4a92f38
Revises: a9d4f2016c73
Create Date: 2026-08-06 13:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b1e7c4a92f38'
down_revision: Union[str, None] = 'a9d4f2016c73'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("bids", sa.Column("intro", sa.String(), nullable=True))
    op.create_table(
        "bid_projects",
        sa.Column("bid_id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["bid_id"], ["bids.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["designer_projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("bid_id", "project_id"),
    )


def downgrade() -> None:
    op.drop_table("bid_projects")
    op.drop_column("bids", "intro")
