from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import CrawlStatus, RecordType
from app.schemas.common import Page


class CrawlJobOut(BaseModel):
    id: int
    source_id: int
    source_name: str | None = None
    status: CrawlStatus
    started_at: datetime | None
    finished_at: datetime | None
    error_message: str | None
    pages_fetched: int
    records_extracted: int


class CrawlJobPage(Page[CrawlJobOut]):
    pass


class FailedExtractionOut(BaseModel):
    id: int
    title: str
    record_type: RecordType
    source_id: int
    source_name: str | None = None
    source_url: str
    extraction_confidence: float
    updated_at: datetime


class FailedExtractionPage(Page[FailedExtractionOut]):
    pass


class AdminSourceOut(BaseModel):
    id: int
    name: str
    base_url: str
    country: str | None
    source_class: str
    trust_tier: str
    access_method: str
    crawl_frequency_minutes: int
    is_active: bool
    parser_key: str
    created_at: datetime
    updated_at: datetime
    opportunity_count: int = 0
    active_opportunity_count: int = 0
    raw_document_count: int = 0
    last_crawl_status: CrawlStatus | None = None
    last_crawl_started_at: datetime | None = None
    last_crawl_finished_at: datetime | None = None
    last_pages_fetched: int = 0
    last_records_extracted: int = 0


class AdminOverviewStats(BaseModel):
    total_sources: int
    active_sources: int
    total_opportunities: int
    active_opportunities: int
    total_users: int
    total_alert_rules: int
    running_crawls: int
    failed_crawls_last_24h: int
    queued_alert_events: int


class AdminOverviewOut(BaseModel):
    stats: AdminOverviewStats
    recent_crawls: list[CrawlJobOut]
    sources: list[AdminSourceOut]


class AdminAiSettingsOut(BaseModel):
    groq_api_key_configured: bool
    groq_model: str


class AdminAiSettingsUpdate(BaseModel):
    groq_api_key: str | None = Field(default=None, min_length=1, max_length=255)
    groq_model: str = Field(default="llama-3.3-70b-versatile", min_length=1, max_length=120)
