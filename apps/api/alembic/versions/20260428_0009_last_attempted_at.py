"""Add last_attempted_at to sources

Revision ID: 20260428_0009
Revises: 20260428_0008
Create Date: 2026-04-28
"""

from alembic import op

revision = "20260428_0009"
down_revision = "20260428_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMPTZ")
    op.execute("UPDATE sources SET last_attempted_at = last_crawled_at WHERE last_attempted_at IS NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE sources DROP COLUMN IF EXISTS last_attempted_at")
