"""designer public profile: contact/social links

Revision ID: f8a2d0c53b41
Revises: e7c1a9f4d206
Create Date: 2026-08-05 20:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f8a2d0c53b41'
down_revision: Union[str, None] = 'e7c1a9f4d206'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for col in ("website", "behance", "dribbble", "instagram"):
        op.add_column("designer_profiles", sa.Column(col, sa.String(), nullable=True))


def downgrade() -> None:
    for col in ("instagram", "dribbble", "behance", "website"):
        op.drop_column("designer_profiles", col)
