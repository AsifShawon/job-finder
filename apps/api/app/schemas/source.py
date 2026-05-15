from datetime import datetime

from pydantic import BaseModel, ConfigDict, HttpUrl

from app.models.enums import AccessMethod, SourceClass, TrustTier


class SourceBase(BaseModel):
    name: str
    base_url: HttpUrl
    country: str | None = "Bangladesh"
    country_scope: str | None = None

    source_type: str | None = None
    ingestion_mode: str | None = None
    connector_key: str | None = None
    trust_level: str | None = None
    compliance_status: str = "unknown"
    crawl_frequency: str = "daily"
    first_crawl_mode: str = "active_only"

    feed_type: str | None = None       # rss | html | api | pdf
    auto_publish: bool = False
    is_official_seed_source: bool = False
    is_deletable: bool = True
    settings_json: dict = {}

    target_audience: list[str] = []
    search_keywords: list[str] = []

    enabled: bool = True
    requires_admin_review: bool = True

    # Legacy fields — kept for backward compat with existing bulk-import CSVs
    source_class: SourceClass = SourceClass.news_policy
    trust_tier: TrustTier = TrustTier.news_only
    access_method: AccessMethod = AccessMethod.static_html
    crawl_frequency_minutes: int = 1440
    parser_key: str = "default"
    search_queries: list[str] = []
    search_results_limit: int = 10
    child_page_limit: int = 10
    page_ai_limit: int = 25
    max_jobs_per_page: int = 10


class SourceCreate(SourceBase):
    pass


class SourceUpdate(BaseModel):
    name: str | None = None
    base_url: HttpUrl | None = None
    country: str | None = None
    country_scope: str | None = None
    source_type: str | None = None
    ingestion_mode: str | None = None
    connector_key: str | None = None
    trust_level: str | None = None
    compliance_status: str | None = None
    crawl_frequency: str | None = None
    first_crawl_mode: str | None = None
    target_audience: list[str] | None = None
    search_keywords: list[str] | None = None
    feed_type: str | None = None
    auto_publish: bool | None = None
    enabled: bool | None = None
    requires_admin_review: bool | None = None
    # Legacy
    source_class: SourceClass | None = None
    trust_tier: TrustTier | None = None
    access_method: AccessMethod | None = None
    crawl_frequency_minutes: int | None = None
    parser_key: str | None = None
    search_queries: list[str] | None = None
    is_active: bool | None = None
    search_results_limit: int | None = None
    child_page_limit: int | None = None
    page_ai_limit: int | None = None
    max_jobs_per_page: int | None = None


class SourceOut(SourceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    root_url: str | None = None
    last_attempted_at: datetime | None = None
    last_crawled_at: datetime | None = None
    last_success_at: datetime | None = None
    last_error: str | None = None
    last_status: str | None = None
    discovered_item_count: int = 0
    imported_job_count: int = 0
    skipped_item_count: int = 0
    needs_review_count: int = 0
    created_at: datetime
    updated_at: datetime
