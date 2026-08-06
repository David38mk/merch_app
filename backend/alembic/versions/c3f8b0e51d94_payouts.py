"""designer payouts (withdrawal history)

Revision ID: c3f8b0e51d94
Revises: b1e7c4a92f38
Create Date: 2026-08-06 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'c3f8b0e51d94'
down_revision: Union[str, None] = 'b1e7c4a92f38'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# create_type=False so create_table doesn't re-emit CREATE TYPE (we create it explicitly).
payoutstatus = postgresql.ENUM(
    "REQUESTED", "PROCESSING", "PAID", "FAILED", name="payoutstatus", create_type=False
)


def upgrade() -> None:
    payoutstatus.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "payouts",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("designer_profile_id", sa.UUID(), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("status", payoutstatus, nullable=False, server_default="PROCESSING"),
        sa.Column("method", sa.String(), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["designer_profile_id"], ["designer_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_payouts_designer_profile_id"), "payouts", ["designer_profile_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_payouts_designer_profile_id"), table_name="payouts")
    op.drop_table("payouts")
    payoutstatus.drop(op.get_bind(), checkfirst=True)
