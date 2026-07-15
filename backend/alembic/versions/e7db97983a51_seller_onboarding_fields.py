"""seller onboarding fields

Revision ID: e7db97983a51
Revises: 6b2d2acf08ec
Create Date: 2026-07-14 12:07:47.195824
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'e7db97983a51'
down_revision: Union[str, None] = '6b2d2acf08ec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Postgres native enum — alembic autogenerate does NOT create the type for a new
# enum column, so we create/drop it explicitly. create_type=False stops the
# add_column from also trying to emit CREATE TYPE.
account_type = postgresql.ENUM("PERSONAL", "COMPANY", name="accounttype", create_type=False)


def upgrade() -> None:
    account_type.create(op.get_bind(), checkfirst=True)
    op.add_column("seller_profiles", sa.Column("creator_name", sa.String(), nullable=True))
    op.add_column("seller_profiles", sa.Column("country", sa.String(), nullable=True))
    op.add_column("seller_profiles", sa.Column("currency", sa.String(), nullable=True))
    op.add_column(
        "seller_profiles",
        sa.Column("account_type", account_type, server_default="PERSONAL", nullable=False),
    )
    op.add_column(
        "seller_profiles",
        sa.Column("onboarding_completed", sa.Boolean(), server_default="false", nullable=False),
    )
    op.alter_column("seller_profiles", "slug", existing_type=sa.VARCHAR(), nullable=True)
    op.alter_column("seller_profiles", "store_name", existing_type=sa.VARCHAR(), nullable=True)


def downgrade() -> None:
    op.alter_column("seller_profiles", "store_name", existing_type=sa.VARCHAR(), nullable=False)
    op.alter_column("seller_profiles", "slug", existing_type=sa.VARCHAR(), nullable=False)
    op.drop_column("seller_profiles", "onboarding_completed")
    op.drop_column("seller_profiles", "account_type")
    op.drop_column("seller_profiles", "currency")
    op.drop_column("seller_profiles", "country")
    op.drop_column("seller_profiles", "creator_name")
    account_type.drop(op.get_bind(), checkfirst=True)
