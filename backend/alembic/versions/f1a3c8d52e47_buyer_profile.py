"""buyer profile: phone, currency preference, saved addresses

Revision ID: f1a3c8d52e47
Revises: e9f2b7c4a10d
Create Date: 2026-07-24 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f1a3c8d52e47'
down_revision: Union[str, None] = 'e9f2b7c4a10d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone", sa.String(), nullable=True))
    op.add_column("settings", sa.Column("currency", sa.String(), nullable=False, server_default="EUR"))

    # The enum is created implicitly by create_table (single CREATE TYPE).
    op.create_table(
        "addresses",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("address_type", sa.Enum("SHIPPING", "BILLING", name="addresstype"), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("line1", sa.String(), nullable=False),
        sa.Column("line2", sa.String(), nullable=True),
        sa.Column("city", sa.String(), nullable=False),
        sa.Column("region", sa.String(), nullable=True),
        sa.Column("postal_code", sa.String(), nullable=False),
        sa.Column("country", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("addresses")
    op.execute("DROP TYPE IF EXISTS addresstype")  # Postgres keeps the enum after drop_table
    op.drop_column("settings", "currency")
    op.drop_column("users", "phone")
