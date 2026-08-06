"""product reviews: ratings, photos, reports

Revision ID: f3c9a071d284
Revises: e2b6c4f80917
Create Date: 2026-08-05 15:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f3c9a071d284'
down_revision: Union[str, None] = 'e2b6c4f80917'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    review_status = sa.Enum("PUBLISHED", "HIDDEN", name="reviewstatus")

    op.create_table(
        "product_reviews",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("shop_item_id", sa.Uuid(), nullable=False),
        sa.Column("buyer_user_id", sa.Uuid(), nullable=False),
        sa.Column("order_id", sa.Uuid(), nullable=True),
        sa.Column("reviewer_name", sa.String(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("body", sa.String(), nullable=False),
        sa.Column("status", review_status, nullable=False, server_default="PUBLISHED"),
        sa.Column("report_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["shop_item_id"], ["shop_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["buyer_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("buyer_user_id", "shop_item_id", name="uq_review_one_per_product"),
    )
    op.create_index("ix_product_reviews_shop_item_id", "product_reviews", ["shop_item_id"])

    op.create_table(
        "review_photos",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("review_id", sa.Uuid(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["review_id"], ["product_reviews.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "review_reports",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("review_id", sa.Uuid(), nullable=False),
        sa.Column("reporter_user_id", sa.Uuid(), nullable=False),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["review_id"], ["product_reviews.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reporter_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("review_id", "reporter_user_id", name="uq_review_report"),
    )


def downgrade() -> None:
    op.drop_table("review_reports")
    op.drop_table("review_photos")
    op.drop_index("ix_product_reviews_shop_item_id", table_name="product_reviews")
    op.drop_table("product_reviews")
    sa.Enum(name="reviewstatus").drop(op.get_bind(), checkfirst=True)
