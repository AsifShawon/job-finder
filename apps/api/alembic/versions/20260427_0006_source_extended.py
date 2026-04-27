"""add source categorization fields

Revision ID: 20260427_0006
Revises: 20260427_0005
Create Date: 2026-04-27
"""

from alembic import op

revision = "20260427_0006"
down_revision = "20260427_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE sources ADD COLUMN IF NOT EXISTS source_type VARCHAR(40)")
    op.execute("ALTER TABLE sources ADD COLUMN IF NOT EXISTS ingestion_mode VARCHAR(40)")
    op.execute("ALTER TABLE sources ADD COLUMN IF NOT EXISTS connector_key VARCHAR(60)")
    op.execute("ALTER TABLE sources ADD COLUMN IF NOT EXISTS country_scope VARCHAR(255)")
    op.execute("ALTER TABLE sources ADD COLUMN IF NOT EXISTS target_audience JSONB NOT NULL DEFAULT '[]'")
    op.execute("ALTER TABLE sources ADD COLUMN IF NOT EXISTS trust_level VARCHAR(40)")
    op.execute("ALTER TABLE sources ADD COLUMN IF NOT EXISTS compliance_status VARCHAR(40) DEFAULT 'unknown'")
    op.execute("ALTER TABLE sources ADD COLUMN IF NOT EXISTS crawl_frequency VARCHAR(20) DEFAULT 'daily'")
    op.execute("ALTER TABLE sources ADD COLUMN IF NOT EXISTS requires_admin_review BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_crawled_at TIMESTAMPTZ")
    op.execute("ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ")
    op.execute("ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_error TEXT")
    # Backfill: map existing fields to new ones
    op.execute("""
        UPDATE sources SET
            source_type = CASE source_class::text
                WHEN 'bd_migration' THEN 'job_board'
                WHEN 'foreign_jobs' THEN 'job_board'
                WHEN 'scholarship' THEN 'scholarship'
                WHEN 'news_policy' THEN 'news'
                ELSE 'news'
            END,
            ingestion_mode = CASE access_method::text
                WHEN 'api' THEN 'api'
                WHEN 'rss' THEN 'rss'
                WHEN 'pdf' THEN 'pdf'
                ELSE 'html'
            END,
            trust_level = CASE trust_tier::text
                WHEN 'official_gov' THEN 'government_official'
                WHEN 'official_partner' THEN 'official_partner'
                WHEN 'established_portal' THEN 'verified_source'
                ELSE 'news_source'
            END,
            compliance_status = 'allowed',
            crawl_frequency = CASE
                WHEN crawl_frequency_minutes <= 60 THEN 'hourly'
                WHEN crawl_frequency_minutes <= 1440 THEN 'daily'
                ELSE 'weekly'
            END
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE sources DROP COLUMN IF EXISTS last_error")
    op.execute("ALTER TABLE sources DROP COLUMN IF EXISTS last_success_at")
    op.execute("ALTER TABLE sources DROP COLUMN IF EXISTS last_crawled_at")
    op.execute("ALTER TABLE sources DROP COLUMN IF EXISTS requires_admin_review")
    op.execute("ALTER TABLE sources DROP COLUMN IF EXISTS crawl_frequency")
    op.execute("ALTER TABLE sources DROP COLUMN IF EXISTS compliance_status")
    op.execute("ALTER TABLE sources DROP COLUMN IF EXISTS trust_level")
    op.execute("ALTER TABLE sources DROP COLUMN IF EXISTS target_audience")
    op.execute("ALTER TABLE sources DROP COLUMN IF EXISTS country_scope")
    op.execute("ALTER TABLE sources DROP COLUMN IF EXISTS connector_key")
    op.execute("ALTER TABLE sources DROP COLUMN IF EXISTS ingestion_mode")
    op.execute("ALTER TABLE sources DROP COLUMN IF EXISTS source_type")
