"""cart money model: order shipping/tax/discount/total + discount codes

Revision ID: a4c7e91f28b6
Revises: f1a3c8d52e47
Create Date: 2026-07-24 15:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a4c7e91f28b6'
down_revision: Union[str, None] = 'f1a3c8d52e47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── order money fields ────────────────────────────────────────────────────
    op.add_column("orders", sa.Column("discount_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
    op.add_column("orders", sa.Column("discount_code", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("shipping_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
    op.add_column("orders", sa.Column("tax_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
    op.add_column("orders", sa.Column("total_amount", sa.Numeric(10, 2), nullable=False, server_default="0"))
    # Existing orders predate shipping/tax — their total was just the subtotal.
    op.execute("UPDATE orders SET total_amount = subtotal WHERE total_amount = 0")

    # ── discount codes ────────────────────────────────────────────────────────
    op.create_table(
        "discount_codes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("kind", sa.Enum("PERCENT", "FIXED", name="discountkind"), nullable=False),
        sa.Column("value", sa.Numeric(10, 2), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("min_subtotal", sa.Numeric(10, 2), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("seller_profile_id", sa.Uuid(), sa.ForeignKey("seller_profiles.id", ondelete="CASCADE"), nullable=True),
        sa.Column("max_uses", sa.Integer(), nullable=True),
        sa.Column("used_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_discount_codes_code", "discount_codes", ["code"], unique=True)

    # A demo platform-wide code so the flow is testable out of the box.
    op.execute(
        "INSERT INTO discount_codes (id, code, kind, value, active, min_subtotal, used_count, created_at) "
        "VALUES (gen_random_uuid(), 'WELCOME10', 'PERCENT', 10, true, NULL, 0, now())"
    )
    op.execute(
        "INSERT INTO discount_codes (id, code, kind, value, active, min_subtotal, used_count, created_at) "
        "VALUES (gen_random_uuid(), 'SAVE5', 'FIXED', 5, true, 25, 0, now())"
    )


def downgrade() -> None:
    op.drop_index("ix_discount_codes_code", table_name="discount_codes")
    op.drop_table("discount_codes")
    op.execute("DROP TYPE IF EXISTS discountkind")
    for col in ("total_amount", "tax_amount", "shipping_amount", "discount_code", "discount_amount"):
        op.drop_column("orders", col)
