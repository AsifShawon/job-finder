"""add current_status to user_profiles and onboarding_complete to users

Revision ID: 20260426_0003
Revises: 20260424_0002
Create Date: 2026-04-26
"""

from alembic import op
import sqlalchemy as sa

revision = "20260426_0003"
down_revision = "20260424_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_profiles", sa.Column("current_status", sa.String(length=80), nullable=True))
    op.add_column("users", sa.Column("onboarding_complete", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("user_profiles", "current_status")
    op.drop_column("users", "onboarding_complete")
