"""add bilingual _bn/_en variants for opportunity content fields + mirror_urls

Revision ID: 20260509_0015
Revises: 20260504_0014
Create Date: 2026-05-09

Bangla-first goal: every public-facing content field has both _bn and _en
variants so the locale toggle switches the entire opportunity. Existing single-
language columns stay as the canonical (source-language) value; the translation
worker backfills _bn and _en. Additive only — no data loss.

Also adds mirror_urls JSONB for cross-source dedup (Phase 2.3).
"""

from alembic import op


revision = "20260509_0015"
down_revision = "20260504_0014"
branch_labels = None
depends_on = None


# (column_name, type_sql) — every column added IF NOT EXISTS, nullable
TEXT_PAIRS = [
    "title_en",
    "job_title_bn", "job_title_en",
    "salary_text_bn", "salary_text_en",
    "location_text_bn", "location_text_en",
    "eligibility_text_bn", "eligibility_text_en",
    "required_documents_bn", "required_documents_en",
    "application_process_bn", "application_process_en",
    "education_requirement_bn", "education_requirement_en",
    "experience_requirement_bn", "experience_requirement_en",
    "language_requirement_bn", "language_requirement_en",
    "visa_or_work_permit_info_bn", "visa_or_work_permit_info_en",
]

JSONB_LIST_PAIRS = [
    "journey_steps_bn", "journey_steps_en",
    "documents_needed_bn", "documents_needed_en",
]


def upgrade() -> None:
    # title_en gets String(500) to mirror title; everything else is TEXT
    op.execute(
        "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS title_en VARCHAR(500)"
    )
    op.execute(
        "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS job_title_bn VARCHAR(255)"
    )
    op.execute(
        "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS job_title_en VARCHAR(255)"
    )
    op.execute(
        "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS salary_text_bn VARCHAR(255)"
    )
    op.execute(
        "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS salary_text_en VARCHAR(255)"
    )
    op.execute(
        "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS location_text_bn VARCHAR(255)"
    )
    op.execute(
        "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS location_text_en VARCHAR(255)"
    )
    op.execute(
        "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS language_requirement_bn VARCHAR(255)"
    )
    op.execute(
        "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS language_requirement_en VARCHAR(255)"
    )

    for col in [
        "eligibility_text_bn", "eligibility_text_en",
        "required_documents_bn", "required_documents_en",
        "application_process_bn", "application_process_en",
        "education_requirement_bn", "education_requirement_en",
        "experience_requirement_bn", "experience_requirement_en",
        "visa_or_work_permit_info_bn", "visa_or_work_permit_info_en",
    ]:
        op.execute(f"ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS {col} TEXT")

    for col in JSONB_LIST_PAIRS:
        op.execute(
            f"ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS {col} JSONB "
            "NOT NULL DEFAULT '[]'::jsonb"
        )

    op.execute(
        "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS mirror_urls JSONB "
        "NOT NULL DEFAULT '[]'::jsonb"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS mirror_urls")
    for col in JSONB_LIST_PAIRS:
        op.execute(f"ALTER TABLE opportunities DROP COLUMN IF EXISTS {col}")
    for col in TEXT_PAIRS:
        op.execute(f"ALTER TABLE opportunities DROP COLUMN IF EXISTS {col}")
