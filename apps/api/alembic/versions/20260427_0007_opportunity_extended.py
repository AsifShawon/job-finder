"""add opportunity typing and eligibility fields

Revision ID: 20260427_0007
Revises: 20260427_0006
Create Date: 2026-04-27
"""

from alembic import op

revision = "20260427_0007"
down_revision = "20260427_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Opportunity type / classification
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS opportunity_type VARCHAR(40)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS connector_key VARCHAR(60)")
    # Bilingual title/summary
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS title_bn VARCHAR(500)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS summary_en TEXT")
    # Location / salary (raw text)
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS destination_country VARCHAR(120)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS salary_text VARCHAR(255)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS location_text VARCHAR(255)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS posted_date DATE")
    # Requirements (structured text)
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS application_process TEXT")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS education_requirement TEXT")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS experience_requirement TEXT")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS language_requirement VARCHAR(255)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS age_requirement VARCHAR(120)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS gender_requirement VARCHAR(120)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS visa_or_work_permit_info TEXT")
    # Eligibility flags
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS lmia_status VARCHAR(20)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS can_apply_from_bd BOOLEAN")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS requires_existing_work_permit BOOLEAN")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS open_to_international_candidates BOOLEAN")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS open_to_authorized_workers_only BOOLEAN")
    op.execute(
        "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS target_audience_tags JSONB NOT NULL DEFAULT '[]'"
    )
    # Application
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS original_apply_url VARCHAR(2048)")
    # Raw LLM extraction payload
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS extracted_json JSONB")
    # Indexes for common eligibility filters
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_opportunity_can_apply_from_bd ON opportunities (can_apply_from_bd)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_opportunity_opportunity_type ON opportunities (opportunity_type)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_opportunity_lmia_status ON opportunities (lmia_status)"
    )
    # Backfill opportunity_type from record_type
    op.execute("""
        UPDATE opportunities SET
            opportunity_type = CASE record_type::text
                WHEN 'job' THEN 'overseas_job'
                WHEN 'scholarship' THEN 'scholarship'
                WHEN 'policy_update' THEN 'migration_policy'
                ELSE NULL
            END
        WHERE opportunity_type IS NULL
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_opportunity_lmia_status")
    op.execute("DROP INDEX IF EXISTS ix_opportunity_opportunity_type")
    op.execute("DROP INDEX IF EXISTS ix_opportunity_can_apply_from_bd")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS extracted_json")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS original_apply_url")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS target_audience_tags")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS open_to_authorized_workers_only")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS open_to_international_candidates")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS requires_existing_work_permit")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS can_apply_from_bd")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS lmia_status")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS visa_or_work_permit_info")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS gender_requirement")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS age_requirement")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS language_requirement")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS experience_requirement")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS education_requirement")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS application_process")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS posted_date")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS location_text")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS salary_text")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS destination_country")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS summary_en")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS title_bn")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS connector_key")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS opportunity_type")
