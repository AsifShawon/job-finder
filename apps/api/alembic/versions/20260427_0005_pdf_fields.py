"""add PDF and review fields to opportunities

Revision ID: 20260427_0005
Revises: 20260426_0004
Create Date: 2026-04-27
"""

from alembic import op

revision = "20260427_0005"
down_revision = "20260426_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS document_url VARCHAR(2048)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) DEFAULT 'html'")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS extracted_text TEXT")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS summary_bn TEXT")
    op.execute(
        "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS needs_admin_review BOOLEAN NOT NULL DEFAULT FALSE"
    )
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS review_status VARCHAR(20)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_opportunity_content_hash ON opportunities (content_hash)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_opportunity_review ON opportunities (needs_admin_review, review_status)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_opportunity_review")
    op.execute("DROP INDEX IF EXISTS ix_opportunity_content_hash")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS content_hash")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS review_status")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS needs_admin_review")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS summary_bn")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS extracted_text")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS content_type")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS document_url")
