from enum import Enum


# ── Source classification ─────────────────────────────────────────────────────

class SourceType(str, Enum):
    news = "news"
    job_board = "job_board"
    job_pdf = "job_pdf"
    policy = "policy"
    scholarship = "scholarship"
    training = "training"
    rss = "rss"
    api = "api"
    linkout_only = "linkout_only"
    hybrid = "hybrid"


class IngestionMode(str, Enum):
    html = "html"
    html_with_pdf = "html_with_pdf"
    pdf = "pdf"
    rss = "rss"
    api = "api"
    open_data = "open_data"
    manual = "manual"
    linkout_only = "linkout_only"
    dynamic_html = "dynamic_html"


class ConnectorKey(str, Enum):
    generic_news = "generic_news"
    generic_rss = "generic_rss"
    generic_pdf = "generic_pdf"
    generic_policy = "generic_policy"
    generic_scholarship = "generic_scholarship"
    generic_training = "generic_training"
    boesl_brms = "boesl_brms"
    boesl_reports_pdf = "boesl_reports_pdf"
    bmet_connector = "bmet_connector"
    oep_connector = "oep_connector"
    eures_connector = "eures_connector"
    usa_jobs_api = "usa_jobs_api"
    reliefweb_api = "reliefweb_api"
    jobbank_linkout = "jobbank_linkout"
    linkout_only = "linkout_only"
    # Legacy — kept for DB backward compat
    jobbank_open_data_or_linkout = "jobbank_open_data_or_linkout"


class TargetAudience(str, Enum):
    bangladeshi_applicants = "bangladeshi_applicants"
    international_candidates = "international_candidates"
    temporary_foreign_workers = "temporary_foreign_workers"
    authorized_workers_only = "authorized_workers_only"
    students = "students"
    skilled_workers = "skilled_workers"
    low_skilled_workers = "low_skilled_workers"
    scholarship_seekers = "scholarship_seekers"


class TrustLevel(str, Enum):
    government_official = "government_official"
    official_partner = "official_partner"
    verified_source = "verified_source"
    news_source = "news_source"
    unknown = "unknown"


class ComplianceStatus(str, Enum):
    allowed = "allowed"
    use_api_only = "use_api_only"
    rss_only = "rss_only"
    linkout_only = "linkout_only"
    manual_review_required = "manual_review_required"
    unknown = "unknown"


class CrawlFrequency(str, Enum):
    hourly = "hourly"
    daily = "daily"
    weekly = "weekly"
    manual = "manual"


class FirstCrawlMode(str, Enum):
    active_only = "active_only"
    backfill_recent = "backfill_recent"
    backfill_all = "backfill_all"
    preview_only = "preview_only"
    linkout_only = "linkout_only"


# ── Crawl run ─────────────────────────────────────────────────────────────────

class CrawlRunStatus(str, Enum):
    queued = "queued"
    running = "running"
    success = "success"
    success_empty = "success_empty"
    partial_success = "partial_success"
    failed = "failed"
    failed_config = "failed_config"
    skipped = "skipped"
    skipped_recently = "skipped_recently"
    skipped_compliance = "skipped_compliance"
    linkout_only_skipped = "linkout_only_skipped"


# Legacy alias kept for existing pipeline/admin code
class CrawlStatus(str, Enum):
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"


# ── Opportunity / Draft ───────────────────────────────────────────────────────

class OpportunityType(str, Enum):
    overseas_job = "overseas_job"
    local_job = "local_job"
    scholarship = "scholarship"
    training = "training"
    migration_policy = "migration_policy"
    visa_update = "visa_update"
    circular = "circular"
    warning = "warning"
    news = "news"


class ContentType(str, Enum):
    html = "html"
    pdf = "pdf"
    html_with_pdf = "html_with_pdf"
    image_pdf = "image_pdf"
    api = "api"
    rss = "rss"
    manual = "manual"
    unknown = "unknown"


class LMIAStatus(str, Enum):
    none = "none"
    requested = "requested"
    approved = "approved"
    unknown = "unknown"


class EligibilityStatus(str, Enum):
    eligible = "eligible"
    conditional = "conditional"
    authorized_workers_only = "authorized_workers_only"
    unclear_manual_review = "unclear_manual_review"
    not_relevant = "not_relevant"


class ReviewStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    needs_manual_fix = "needs_manual_fix"


class OpportunityStatus(str, Enum):
    pending = "pending"
    published = "published"
    rejected = "rejected"
    expired = "expired"


class FeedType(str, Enum):
    rss = "rss"
    html = "html"
    api = "api"
    pdf = "pdf"


# ── User / feedback ───────────────────────────────────────────────────────────

class FeedbackType(str, Enum):
    useful = "useful"
    inaccurate = "inaccurate"
    outdated = "outdated"
    other = "other"


# ── Legacy enums (kept for DB/migration backward compat) ─────────────────────

class SourceClass(str, Enum):
    bd_migration = "bd_migration"
    foreign_jobs = "foreign_jobs"
    scholarship = "scholarship"
    news_policy = "news_policy"


class TrustTier(str, Enum):
    official_gov = "official_gov"
    official_partner = "official_partner"
    established_portal = "established_portal"
    news_only = "news_only"


class AccessMethod(str, Enum):
    api = "api"
    rss = "rss"
    static_html = "static_html"
    dynamic_html = "dynamic_html"
    pdf = "pdf"


class RecordType(str, Enum):
    job = "job"
    scholarship = "scholarship"
    policy_update = "policy_update"


class OpportunityLevel(str, Enum):
    entry = "entry"
    mid = "mid"
    senior = "senior"
    unknown = "unknown"
