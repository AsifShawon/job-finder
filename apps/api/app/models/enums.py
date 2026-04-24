from enum import Enum


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


class CrawlStatus(str, Enum):
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"


class RecordType(str, Enum):
    job = "job"
    scholarship = "scholarship"
    policy_update = "policy_update"


class OpportunityLevel(str, Enum):
    entry = "entry"
    mid = "mid"
    senior = "senior"
    unknown = "unknown"


class FeedbackType(str, Enum):
    useful = "useful"
    inaccurate = "inaccurate"
    outdated = "outdated"
    other = "other"
