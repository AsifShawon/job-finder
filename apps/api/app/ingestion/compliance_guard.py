"""
Enforces crawling compliance rules before a connector fetches a source.
Raises ComplianceError when crawling is prohibited; returns a warning string for grey areas.
"""
from __future__ import annotations

import time
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.entities import Source


class ComplianceError(Exception):
    """Raised when a source must not be crawled under any circumstances."""

    def __init__(self, message: str, code: str = "compliance") -> None:
        super().__init__(message)
        self.code = code


# Per-domain crawl delay tracking (in-process; Celery workers are typically single-threaded per task)
_last_crawl: dict[str, float] = {}
_DEFAULT_CRAWL_DELAY_S = 5.0
_CRAWL_DELAYS: dict[str, float] = {
    "hourly": 2.0,
    "daily": 5.0,
    "weekly": 10.0,
    "manual": 30.0,
}


def _domain(url: str) -> str:
    try:
        from urllib.parse import urlparse
        return urlparse(url).netloc
    except Exception:
        return url


def check_before_crawl(source: "Source", *, force: bool = False) -> str | None:
    """
    Returns None if crawling is fully allowed.
    Returns a warning string if crawling is allowed but limited.
    Raises ComplianceError if crawling is forbidden.
    """
    compliance = source.compliance_status or "unknown"
    ingestion_mode = source.ingestion_mode or "html"

    # ── Hard blocks ────────────────────────────────────────────────────────────
    if compliance == "linkout_only":
        return (
            f"Source '{source.name}' is linkout_only — no scraping permitted. "
            "Store the external URL and display it without fetching."
        )
    if compliance == "use_api_only" and ingestion_mode not in ("api", "rss", "open_data", "linkout_only"):
        raise ComplianceError(
            f"Source '{source.name}' requires API-only access but ingestion_mode='{ingestion_mode}'. "
            "Switch connector to an API/open-data connector.",
            code="use_api_only",
        )
    if compliance == "manual_review_required":
        raise ComplianceError(
            f"Source '{source.name}' has compliance_status=manual_review_required. "
            "A human must approve crawling this source before automation runs.",
            code="manual_review_required",
        )

    # ── Soft warnings ──────────────────────────────────────────────────────────
    warning: str | None = None
    if compliance == "rss_only" and ingestion_mode not in ("rss", "api"):
        warning = (
            f"Source '{source.name}' should be accessed via RSS only "
            "(compliance_status=rss_only), but ingestion_mode='{ingestion_mode}'."
        )
    if compliance == "unknown":
        warning = f"Source '{source.name}' has unknown compliance status — crawling with caution."

    # ── Crawl delay ────────────────────────────────────────────────────────────
    domain = _domain(source.base_url)
    delay_s = _CRAWL_DELAYS.get(source.crawl_frequency or "daily", _DEFAULT_CRAWL_DELAY_S)
    last = _last_crawl.get(domain)
    if last is not None:
        elapsed = time.monotonic() - last
        if elapsed < delay_s:
            time.sleep(delay_s - elapsed)
    _last_crawl[domain] = time.monotonic()

    # ── Frequency gating (skip if crawled too recently) ────────────────────────
    if source.last_crawled_at is not None and not force:
        freq = source.crawl_frequency or "daily"
        min_interval: timedelta
        if freq == "hourly":
            min_interval = timedelta(minutes=50)
        elif freq == "daily":
            min_interval = timedelta(hours=20)
        elif freq == "weekly":
            min_interval = timedelta(days=6)
        else:
            min_interval = timedelta(days=0)

        age = datetime.now(UTC) - source.last_crawled_at
        if age < min_interval:
            raise ComplianceError(
                f"Source '{source.name}' was crawled {int(age.total_seconds() / 60)} minutes ago; "
                f"minimum interval for '{freq}' not yet elapsed.",
                code="recently_crawled",
            )

    return warning
