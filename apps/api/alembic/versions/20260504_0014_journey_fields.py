"""add journey and salary helper fields to opportunities

Revision ID: 20260504_0014
Revises: 20260502_0013
Create Date: 2026-05-04
"""

from alembic import op

revision = "20260504_0014"
down_revision = "20260502_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE opportunities
        ADD COLUMN IF NOT EXISTS journey_steps JSONB NOT NULL DEFAULT '[]'::jsonb
        """
    )
    op.execute(
        """
        ALTER TABLE opportunities
        ADD COLUMN IF NOT EXISTS documents_needed JSONB NOT NULL DEFAULT '[]'::jsonb
        """
    )
    op.execute(
        """
        ALTER TABLE opportunities
        ADD COLUMN IF NOT EXISTS typical_salary_bdt INTEGER
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS typical_salary_bdt")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS documents_needed")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS journey_steps")
