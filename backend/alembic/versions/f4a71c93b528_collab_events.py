"""collaboration activity events

Revision ID: f4a71c93b528
Revises: e8f2a6b41d73
Create Date: 2026-07-15 20:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f4a71c93b528'
down_revision: Union[str, None] = 'e8f2a6b41d73'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

collab_event_type = postgresql.ENUM(
    "CREATED", "STARTED", "DRAFT_SUBMITTED", "REVISION_REQUESTED", "DRAFT_APPROVED",
    "FINAL_SUBMITTED", "APPROVED", "PAYMENT_COMPLETED", "PRODUCT_CREATED", "COMPLETED",
    name="collabeventtype", create_type=False,
)


def upgrade() -> None:
    collab_event_type.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "collab_events",
        sa.Column("collab_id", sa.Uuid(), nullable=False),
        sa.Column("type", collab_event_type, nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["collab_id"], ["collaborations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_collab_events_collab_id", "collab_events", ["collab_id"])


def downgrade() -> None:
    op.drop_index("ix_collab_events_collab_id", table_name="collab_events")
    op.drop_table("collab_events")
    collab_event_type.drop(op.get_bind(), checkfirst=True)
