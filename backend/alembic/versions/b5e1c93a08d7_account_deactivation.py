"""account settings: delete-account request (users.deactivated_at)

Revision ID: b5e1c93a08d7
Revises: a4d70e8c2f16
Create Date: 2026-08-05 17:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b5e1c93a08d7'
down_revision: Union[str, None] = 'a4d70e8c2f16'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "deactivated_at")
