"""website builder: draft layer, theme, store info, curation

Revision ID: b1d6e4f28a37
Revises: f4a71c93b528
Create Date: 2026-07-15 22:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b1d6e4f28a37'
down_revision: Union[str, None] = 'f4a71c93b528'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("seller_profiles", sa.Column("storefront_draft", sa.JSON(), nullable=True))
    op.add_column("seller_profiles", sa.Column("theme_primary", sa.String(), nullable=True))
    op.add_column("seller_profiles", sa.Column("theme_accent", sa.String(), nullable=True))
    op.add_column("seller_profiles", sa.Column("button_style", sa.String(), nullable=True))
    op.add_column("seller_profiles", sa.Column("contact_email", sa.String(), nullable=True))
    op.add_column("seller_profiles", sa.Column("location", sa.String(), nullable=True))
    op.add_column("seller_profiles", sa.Column("curation", sa.JSON(), nullable=True))


def downgrade() -> None:
    for col in (
        "curation", "location", "contact_email", "button_style",
        "theme_accent", "theme_primary", "storefront_draft",
    ):
        op.drop_column("seller_profiles", col)
