"""designer auth: designer-agreement acceptance timestamp

Revision ID: c6f2a3901e58
Revises: b5e1c93a08d7
Create Date: 2026-08-05 18:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c6f2a3901e58'
down_revision: Union[str, None] = 'b5e1c93a08d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("designer_agreement_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "designer_agreement_at")
