from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import CrawlRunStatus, CrawlStatus, RecordType
from app.schemas.common import Page


# ── CrawlRun (new) ────────────────────────────────────────────────────────────

class CrawlRunOut(BaseModel):
    id: int
    source_id: int
    source_name: str | None = None
    connector_key: str | None = None
    source_type: str | None = None
    ingestion_mode: str | None = None
    crawl_mode: str | None = None
    status: CrawlRunStatus
    discovered_count: int = 0
    parsed_count: int = 0
    duplicate_count: int = 0
    draft_created_count: int = 0
    draft_updated_count: int = 0
    unchanged_count: int = 0
    skipped_count: int = 0
    failed_count: int = 0
    manual_review_count: int = 0
    started_at: datetime | None = None
    finished_at: datetime | None = None
    error_message: str | None = None
    logs: dict[str, Any] | None = None


class CrawlRunPage(Page[CrawlRunOut]):
    pass


# ── CrawlJob (legacy — kept for backward compat) ──────────────────────────────

class CrawlJobOut(BaseModel):
    id: int
    source_id: int
    source_name: str | None = None
    status: CrawlStatus
    started_at: datetime | None = None
    finished_at: datetime | None = None
    error_message: str | None = None
    pages_fetched: int = 0
    records_extracted: int = 0


class CrawlJobPage(Page[CrawlJobOut]):
    pass


# ── Source admin ──────────────────────────────────────────────────────────────

class AdminSourceOut(BaseModel):
    id: int
    name: str
    base_url: str
    root_url: str | None = None
    country: str | None = None
    country_scope: str | None = None
    source_type: str | None = None
    ingestion_mode: str | None = None
    connector_key: str | None = None
    trust_level: str | None = None
    compliance_status: str | None = None
    crawl_frequency: str | None = None
    first_crawl_mode: str | None = None
    target_audience: list[str] = []
    search_keywords: list[str] = []
    feed_type: str | None = None
    auto_publish: bool = False
    is_official_seed_source: bool = False
    is_deletable: bool = True
    settings_json: dict[str, Any] = {}
    last_status: str | None = None
    discovered_item_count: int = 0
    imported_job_count: int = 0
    skipped_item_count: int = 0
    needs_review_count: int = 0
    enabled: bool = True
    requires_admin_review: bool = True
    last_attempted_at: datetime | None = None
    last_crawled_at: datetime | None = None
    last_success_at: datetime | None = None
    last_error: str | None = None
    created_at: datetime
    updated_at: datetime
    # Legacy
    source_class: str = "news_policy"
    trust_tier: str = "news_only"
    access_method: str = "static_html"
    crawl_frequency_minutes: int = 1440
    is_active: bool = True
    parser_key: str = "default"
    search_queries: list[str] = []
    search_results_limit: int = 10
    child_page_limit: int = 10
    page_ai_limit: int = 25
    max_jobs_per_page: int = 10
    # Computed crawl stats
    draft_count: int = 0
    pending_review_count: int = 0
    published_count: int = 0
    last_crawl_status: str | None = None
    last_crawl_started_at: datetime | None = None
    last_crawl_finished_at: datetime | None = None
    last_pages_fetched: int = 0
    last_records_extracted: int = 0
    # Backward compat aliases
    opportunity_count: int = 0
    active_opportunity_count: int = 0
    raw_document_count: int = 0


# ── Review queue ──────────────────────────────────────────────────────────────

class ReviewQueueOut(BaseModel):
    id: int
    title: str
    title_bn: str | None = None
    opportunity_type: str | None = None
    source_id: int
    source_name: str | None = None
    source_page_url: str
    document_url: str | None = None
    original_apply_url: str | None = None
    content_type: str | None = None
    country: str | None = None
    destination_country: str | None = None
    employer_or_organization: str | None = None
    deadline: str | None = None
    salary_text: str | None = None
    eligibility_status: str | None = None
    can_apply_from_bd: bool | None = None
    requires_existing_work_permit: bool | None = None
    open_to_international_candidates: bool | None = None
    lmia_status: str | None = None
    summary_bn: str | None = None
    summary_en: str | None = None
    extraction_confidence: float = 0.0
    needs_admin_review: bool = True
    review_status: str | None = None
    reviewed_by: int | None = None
    reviewed_at: datetime | None = None
    target_audience_tags: list[str] = []
    risk_flags: list[str] = []
    source_trust_badge: str | None = None
    connector_key: str | None = None
    admin_status: str | None = None
    platform_category_bn: str | None = None
    platform_category_en: str | None = None
    bangladesh_applicability: str | None = None
    bangladesh_applicability_reason: str | None = None
    rural_user_fit_score: float = 0.0
    actionability_score: float = 0.0
    trust_score: float = 0.0
    overall_rank_score: float = 0.0
    extraction_warnings: list[str] = []
    raw_text: str | None = None
    created_at: datetime
    # Per-field confidence map produced by the multi-step extractor.
    # Keys are field names (e.g. 'title', 'deadline_text', 'salary'); values 0..1.
    field_confidences: dict[str, float] | None = None
    # Legacy compat
    record_type: str | None = None
    source_url: str | None = None


class ReviewQueuePage(Page[ReviewQueueOut]):
    pass


class ReviewStatusUpdate(BaseModel):
    status: str  # approved | rejected | needs_manual_fix
    note: str | None = None


class ManualEntryPrefillRequest(BaseModel):
    """Input for `POST /admin/manual-entry/prefill` — fetch a URL, run extraction,
    return form-ready fields without writing to the DB."""
    url: str = Field(min_length=4, max_length=2048)


class ManualEntryPrefillResponse(BaseModel):
    """Form-shaped payload returned by the prefill endpoint. Each field maps 1:1
    to a `FormState` field on the frontend manual-entry form. All optional —
    the reviewer fills the gaps before submit."""
    title: str | None = None
    title_bn: str | None = None
    summary_en: str | None = None
    summary_bn: str | None = None
    raw_description: str | None = None
    country: str | None = None
    employer: str | None = None
    deadline: str | None = None
    opportunity_type: str | None = None
    sector: str | None = None
    degree_level: str | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    salary_currency: str | None = None
    application_url: str | None = None
    eligibility_text: str | None = None
    eligibility_text_bn: str | None = None
    application_process: str | None = None
    application_process_bn: str | None = None
    visa_support: bool | None = None
    can_apply_from_bd: bool | None = None
    requirements: list[str] = []
    benefits: list[str] = []
    language_requirements: list[str] = []
    journey_steps: list[str] = []
    journey_steps_bn: list[str] = []
    documents_needed: list[str] = []
    documents_needed_bn: list[str] = []
    typical_salary_bdt: int | None = None
    extraction_confidence: float = 0.0
    fetched_url: str
    warnings: list[str] = []


class ManualJobEntryRequest(BaseModel):
    title: str
    source_url: str
    raw_description: str
    source_name: str | None = None
    country: str | None = None
    employer: str | None = None
    deadline: str | None = None
    opportunity_type: str = "overseas_job"
    run_ai_extraction: bool = True
    title_bn: str | None = None
    summary_bn: str | None = None
    summary_en: str | None = None
    sector: str | None = None
    degree_level: str | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    salary_currency: str | None = None
    application_url: str | None = None
    eligibility_text: str | None = None
    eligibility_text_bn: str | None = None
    application_process: str | None = None
    application_process_bn: str | None = None
    visa_support: bool | None = None
    can_apply_from_bd: bool | None = None
    requirements: list[str] | None = None
    benefits: list[str] | None = None
    language_requirements: list[str] | None = None
    journey_steps: list[str] | None = None
    journey_steps_bn: list[str] | None = None
    documents_needed: list[str] | None = None
    documents_needed_bn: list[str] | None = None
    typical_salary_bdt: int | None = None


# ── Published opportunity (minimal, for admin list) ───────────────────────────

class PublishedOpportunityOut(BaseModel):
    id: int
    draft_id: int
    title: str
    opportunity_type: str | None = None
    country: str | None = None
    source_name: str | None = None
    can_apply_from_bd: bool | None = None
    published_at: datetime
    is_active: bool = True


# ── Overview / stats ──────────────────────────────────────────────────────────

class AdminOverviewStats(BaseModel):
    total_sources: int
    active_sources: int
    total_drafts: int
    pending_review: int
    total_published: int
    total_users: int
    total_alert_rules: int
    running_crawls: int
    failed_crawls_last_24h: int
    queued_alert_events: int
    # Legacy compat aliases
    total_opportunities: int = 0
    active_opportunities: int = 0


class AdminOverviewOut(BaseModel):
    stats: AdminOverviewStats
    recent_crawls: list[CrawlJobOut] = []
    recent_runs: list[CrawlRunOut] = []
    sources: list[AdminSourceOut] = []


# ── AI settings ───────────────────────────────────────────────────────────────

class AdminAiSettingsOut(BaseModel):
    ai_provider: str
    ai_api_key_configured: bool
    ai_model: str


class AdminAiSettingsUpdate(BaseModel):
    ai_provider: str = Field(default="groq", min_length=1, max_length=20)
    ai_api_key: str | None = Field(default=None, min_length=1, max_length=255)
    ai_model: str = Field(default="", min_length=1, max_length=120)


# ── Bulk import ───────────────────────────────────────────────────────────────

class BulkImportError(BaseModel):
    row: int
    detail: str


class BulkImportResult(BaseModel):
    created: int
    skipped: int
    errors: list[BulkImportError]


class ManualEntryBulkImportResult(BaseModel):
    created: int
    updated: int
    skipped: int
    errors: list[BulkImportError]
    draft_ids: list[int] = []


# ── Trigger all ───────────────────────────────────────────────────────────────

class TriggerAllResult(BaseModel):
    queued: int
    skipped: int


# ── Data reset ────────────────────────────────────────────────────────────────

class DataResetResult(BaseModel):
    deleted_published: int = 0
    deleted_drafts: int = 0
    deleted_raw_documents: int = 0
    deleted_crawl_runs: int = 0
    deleted_crawl_jobs: int = 0
    deleted_sources: int = 0
    # Legacy compat
    deleted_opportunities: int = 0


# ── Source test ───────────────────────────────────────────────────────────────

class SourceTestResult(BaseModel):
    source_id: int
    source_name: str
    pages_found: int
    sample_titles: list[str]
    queries_used: list[str] = []
    search_results_found: int = 0
    child_pages_followed: int = 0
    pages_selected_for_ai: int = 0
    jobs_extracted_preview: int = 0
    compliance_warning: str | None = None
    error: str | None = None


# ── Source probe (URL auto-detect) ────────────────────────────────────────────

class SourceProbeRequest(BaseModel):
    url: str


class SourceProbeResult(BaseModel):
    url: str
    feed_type: str  # rss | html | api | pdf
    suggested_name: str | None = None
    sample_titles: list[str] = []
    detected_language: str | None = None
    suggested_isc_sector: str | None = None
    estimated_opportunities_per_crawl: int | None = None
    is_scrapable: bool = True
    scrape_warning: str | None = None
    error: str | None = None


# ── Legacy (kept for backward compat with existing code) ─────────────────────

class FailedExtractionOut(BaseModel):
    id: int
    title: str
    record_type: RecordType | None = None
    source_id: int
    source_name: str | None = None
    source_url: str
    extraction_confidence: float
    updated_at: datetime


class FailedExtractionPage(Page[FailedExtractionOut]):
    pass
