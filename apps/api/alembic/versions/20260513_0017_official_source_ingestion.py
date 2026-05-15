"""official source ingestion fields and seeds

Revision ID: 20260513_0017
Revises: 20260509_0016
Create Date: 2026-05-13
"""

from alembic import op
import sqlalchemy as sa

revision = "20260513_0017"
down_revision = "20260509_0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    _add_column_if_missing("sources", sa.Column("is_official_seed_source", sa.Boolean(), nullable=False, server_default=sa.false()))
    _add_column_if_missing("sources", sa.Column("is_deletable", sa.Boolean(), nullable=False, server_default=sa.true()))
    _add_column_if_missing("sources", sa.Column("settings_json", sa.JSON(), nullable=False, server_default="{}"))
    _add_column_if_missing("sources", sa.Column("last_status", sa.String(length=40), nullable=True))
    _add_column_if_missing("sources", sa.Column("discovered_item_count", sa.Integer(), nullable=False, server_default="0"))
    _add_column_if_missing("sources", sa.Column("imported_job_count", sa.Integer(), nullable=False, server_default="0"))
    _add_column_if_missing("sources", sa.Column("skipped_item_count", sa.Integer(), nullable=False, server_default="0"))
    _add_column_if_missing("sources", sa.Column("needs_review_count", sa.Integer(), nullable=False, server_default="0"))

    _add_column_if_missing("crawl_runs", sa.Column("unchanged_count", sa.Integer(), nullable=False, server_default="0"))
    _add_column_if_missing("crawl_runs", sa.Column("skipped_count", sa.Integer(), nullable=False, server_default="0"))

    _add_column_if_missing("raw_documents", sa.Column("raw_title", sa.String(length=500), nullable=True))
    _add_column_if_missing("raw_documents", sa.Column("source_job_id", sa.String(length=255), nullable=True))
    _add_column_if_missing("raw_documents", sa.Column("detected_item_type", sa.String(length=60), nullable=True))
    _add_column_if_missing("raw_documents", sa.Column("skip_reason", sa.String(length=500), nullable=True))
    _add_column_if_missing("raw_documents", sa.Column("raw_html_snapshot", sa.Text(), nullable=True))

    _add_column_if_missing("opportunities", sa.Column("platform_category_bn", sa.String(length=120), nullable=True))
    _add_column_if_missing("opportunities", sa.Column("platform_category_en", sa.String(length=120), nullable=True))
    _add_column_if_missing("opportunities", sa.Column("occupation_family", sa.String(length=120), nullable=True))
    _add_column_if_missing("opportunities", sa.Column("education_min", sa.String(length=120), nullable=True))
    _add_column_if_missing("opportunities", sa.Column("experience_min_years", sa.Float(), nullable=True))
    _add_column_if_missing("opportunities", sa.Column("languages_required", sa.JSON(), nullable=False, server_default="[]"))
    _add_column_if_missing("opportunities", sa.Column("accommodation", sa.Boolean(), nullable=True))
    _add_column_if_missing("opportunities", sa.Column("food", sa.Boolean(), nullable=True))
    _add_column_if_missing("opportunities", sa.Column("transport", sa.Boolean(), nullable=True))
    _add_column_if_missing("opportunities", sa.Column("contract_type", sa.String(length=120), nullable=True))
    _add_column_if_missing("opportunities", sa.Column("posting_date", sa.Date(), nullable=True))
    _add_column_if_missing("opportunities", sa.Column("visa_or_iqama_requirement", sa.Text(), nullable=True))
    _add_column_if_missing("opportunities", sa.Column("nationality_requirement", sa.Text(), nullable=True))
    _add_column_if_missing("opportunities", sa.Column("documents_required", sa.JSON(), nullable=False, server_default="[]"))
    _add_column_if_missing("opportunities", sa.Column("application_steps", sa.JSON(), nullable=False, server_default="[]"))
    _add_column_if_missing("opportunities", sa.Column("admin_status", sa.String(length=30), nullable=False, server_default="needs_review"))
    _add_column_if_missing("opportunities", sa.Column("source_trust_tier", sa.String(length=80), nullable=True))
    _add_column_if_missing("opportunities", sa.Column("bangladesh_applicability", sa.String(length=20), nullable=True))
    _add_column_if_missing("opportunities", sa.Column("bangladesh_applicability_reason", sa.Text(), nullable=True))
    _add_column_if_missing("opportunities", sa.Column("rural_user_fit_score", sa.Float(), nullable=False, server_default="0"))
    _add_column_if_missing("opportunities", sa.Column("bangladesh_applicability_score", sa.Float(), nullable=False, server_default="0"))
    _add_column_if_missing("opportunities", sa.Column("category_match_score", sa.Float(), nullable=False, server_default="0"))
    _add_column_if_missing("opportunities", sa.Column("ai_confidence", sa.Float(), nullable=False, server_default="0"))
    _add_column_if_missing("opportunities", sa.Column("extraction_warnings", sa.JSON(), nullable=False, server_default="[]"))
    _add_column_if_missing("opportunities", sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=True))
    _add_column_if_missing("opportunities", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
    _add_column_if_missing("opportunities", sa.Column("missing_count", sa.Integer(), nullable=False, server_default="0"))
    _add_column_if_missing("opportunities", sa.Column("source_content_hash", sa.String(length=64), nullable=True))
    _create_index_if_missing("ix_opportunities_source_content_hash", "opportunities", ["source_content_hash"], unique=False)

    _seed_official_sources()


def downgrade() -> None:
    _drop_index_if_exists("ix_opportunities_source_content_hash", "opportunities")
    for col in [
        "source_content_hash", "missing_count", "last_seen_at", "first_seen_at", "extraction_warnings",
        "ai_confidence", "category_match_score", "bangladesh_applicability_score", "rural_user_fit_score",
        "bangladesh_applicability_reason", "bangladesh_applicability", "source_trust_tier", "admin_status",
        "application_steps", "documents_required", "nationality_requirement", "visa_or_iqama_requirement",
        "posting_date", "contract_type", "transport", "food", "accommodation", "languages_required",
        "experience_min_years", "education_min", "occupation_family", "platform_category_en", "platform_category_bn",
    ]:
        _drop_column_if_exists("opportunities", col)
    for col in ["raw_html_snapshot", "skip_reason", "detected_item_type", "source_job_id", "raw_title"]:
        _drop_column_if_exists("raw_documents", col)
    for col in ["skipped_count", "unchanged_count"]:
        _drop_column_if_exists("crawl_runs", col)
    for col in [
        "needs_review_count", "skipped_item_count", "imported_job_count", "discovered_item_count",
        "last_status", "settings_json", "is_deletable", "is_official_seed_source",
    ]:
        _drop_column_if_exists("sources", col)


def _seed_official_sources() -> None:
    bind = op.get_bind()
    sources = [
        (
            "alfanar Official Careers",
            "https://jobs.alfanar.com/alfanar/go/All-Openings/4442101/",
            "successfactors_alfanar",
            {"company": "alfanar", "country_hint": "Saudi Arabia"},
        ),
        (
            "Aramco European Candidates Careers",
            "https://careers.aramco.com/expat_uk/go/For-European-Candidates/7717923#content",
            "successfactors_aramco",
            {"company": "Aramco", "country_hint": "Saudi Arabia", "conservative": True},
        ),
        (
            "Tamimi Official Careers",
            "https://tamimi.sa/careers.php",
            "tamimi_careers",
            {"company": "Abdulmohsen Al-Tamimi Group", "country_hint": "Saudi Arabia"},
        ),
        (
            "Maharah Posts",
            "https://maharah.com/en/post/",
            "maharah_posts",
            {"company": "Maharah", "country_hint": "Saudi Arabia", "post_intelligence": True},
        ),
    ]
    for name, url, connector_key, settings in sources:
        bind.execute(
            sa.text(
                """
                INSERT INTO sources (
                    name, root_url, base_url, country, source_type, ingestion_mode, connector_key,
                    trust_level, compliance_status, crawl_frequency, first_crawl_mode,
                    target_audience, search_keywords, enabled, requires_admin_review, feed_type,
                    auto_publish, is_active, is_official_seed_source, is_deletable, settings_json,
                    source_class, trust_tier, access_method, parser_key, crawl_frequency_minutes,
                    created_at, updated_at
                )
                VALUES (
                    :name, :url, :url, 'Saudi Arabia', 'job_board', 'html', :connector_key,
                    'official_partner', 'allowed', 'weekly', 'backfill_all',
                    '["bangladeshi_applicants", "low_skilled_workers", "skilled_workers"]'::json,
                    '["electrician", "technician", "mechanic", "driver", "worker", "cleaner", "waiter", "welder"]'::json,
                    true, true, 'html', false, true, true, false, CAST(:settings_json AS json),
                    'foreign_jobs', 'official_partner', 'static_html', 'default', 10080,
                    now(), now()
                )
                ON CONFLICT (name) DO UPDATE SET
                    root_url = EXCLUDED.root_url,
                    base_url = EXCLUDED.base_url,
                    connector_key = EXCLUDED.connector_key,
                    trust_level = EXCLUDED.trust_level,
                    compliance_status = EXCLUDED.compliance_status,
                    is_official_seed_source = true,
                    is_deletable = false,
                    enabled = true,
                    is_active = true,
                    settings_json = EXCLUDED.settings_json,
                    updated_at = now()
                """
            ),
            {
                "name": name,
                "url": url,
                "connector_key": connector_key,
                "settings_json": __import__("json").dumps(settings),
            },
        )


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_column(table_name: str, column_name: str) -> bool:
    return any(column["name"] == column_name for column in _inspector().get_columns(table_name))


def _has_index(table_name: str, index_name: str) -> bool:
    return any(index["name"] == index_name for index in _inspector().get_indexes(table_name))


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    if not _has_column(table_name, column.name):
        op.add_column(table_name, column)


def _drop_column_if_exists(table_name: str, column_name: str) -> None:
    if _has_column(table_name, column_name):
        op.drop_column(table_name, column_name)


def _create_index_if_missing(index_name: str, table_name: str, columns: list[str], unique: bool = False) -> None:
    if not _has_index(table_name, index_name):
        op.create_index(index_name, table_name, columns, unique=unique)


def _drop_index_if_exists(index_name: str, table_name: str) -> None:
    if _has_index(table_name, index_name):
        op.drop_index(index_name, table_name=table_name)
