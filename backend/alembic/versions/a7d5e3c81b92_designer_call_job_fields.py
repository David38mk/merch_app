"""designer call job fields + attachments

Revision ID: a7d5e3c81b92
Revises: b6c2f81ad470
Create Date: 2026-07-15 15:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a7d5e3c81b92'
down_revision: Union[str, None] = 'b6c2f81ad470'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# New Postgres enum — alembic won't CREATE TYPE for us, so do it explicitly.
attachment_kind = postgresql.ENUM(
    "REFERENCE", "BRAND_GUIDELINE", name="attachmentkind", create_type=False
)


def upgrade() -> None:
    # DRAFT joins the existing call status enum (ADD VALUE is transactional on PG 12+).
    op.execute("ALTER TYPE callstatus ADD VALUE IF NOT EXISTS 'DRAFT'")

    op.add_column("designer_calls", sa.Column("base_item_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_designer_calls_base_item", "designer_calls", "base_items", ["base_item_id"], ["id"]
    )
    op.add_column("designer_calls", sa.Column("design_style", sa.String(), nullable=True))
    op.add_column("designer_calls", sa.Column("inspiration_notes", sa.String(), nullable=True))
    op.add_column("designer_calls", sa.Column("desired_launch_date", sa.DateTime(timezone=True), nullable=True))
    op.add_column("designer_calls", sa.Column("revenue_share_percent", sa.Numeric(precision=5, scale=2), nullable=True))

    attachment_kind.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "call_attachments",
        sa.Column("call_id", sa.Uuid(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("kind", attachment_kind, nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["call_id"], ["designer_calls.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_call_attachments_call_id", "call_attachments", ["call_id"])


def downgrade() -> None:
    op.drop_index("ix_call_attachments_call_id", table_name="call_attachments")
    op.drop_table("call_attachments")
    attachment_kind.drop(op.get_bind(), checkfirst=True)

    op.drop_column("designer_calls", "revenue_share_percent")
    op.drop_column("designer_calls", "desired_launch_date")
    op.drop_column("designer_calls", "inspiration_notes")
    op.drop_column("designer_calls", "design_style")
    op.drop_constraint("fk_designer_calls_base_item", "designer_calls", type_="foreignkey")
    op.drop_column("designer_calls", "base_item_id")
    # Postgres has no DROP VALUE for an enum; DRAFT remains on callstatus.
