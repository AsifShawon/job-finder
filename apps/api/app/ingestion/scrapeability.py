from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

from app.core.config import get_settings
from app.ingestion.robots import is_allowed

KNOWN_BLOCKED_DOMAINS = [
    "indeed.com",
    "linkedin.com",
    "naukri.com",
    "glassdoor.com",
    "monster.com",
    "ziprecruiter.com",
    "careerbuilder.com",
    "jobsdb.com",
]

SCRAPABLE_FRIENDLY_PATTERNS = [
    ".gov.bd",
    "reliefweb.int",
    "api.reliefweb.int",
    "ec.europa.eu/eures",
    "/rss",
    ".xml",
]

_BLOCK_MARKERS = [
    "attention required",
    "captcha",
    "cf-browser-verification",
    "just a moment",
    "access denied",
]

_JS_ONLY_MARKERS = [
    "enable javascript",
    "javascript is required",
    "please turn javascript on",
]


@dataclass(slots=True)
class ScrapeabilityResult:
    is_scrapable: bool
    reason: str
    suggested_mode: str


def _host_matches(host: str, candidate: str) -> bool:
    return host == candidate or host.endswith(f".{candidate}")


def _looks_friendly(url: str) -> bool:
    lower_url = url.lower()
    host = (urlparse(url).netloc or "").lower()
    return any(
        pattern.startswith(".") and host.endswith(pattern)
        or pattern in lower_url
        for pattern in SCRAPABLE_FRIENDLY_PATTERNS
    )


def check_scrapeability(url: str) -> ScrapeabilityResult:
    settings = get_settings()
    parsed = urlparse(url)
    host = (parsed.netloc or "").lower().removeprefix("www.")

    for blocked in KNOWN_BLOCKED_DOMAINS:
        if _host_matches(host, blocked):
            return ScrapeabilityResult(
                is_scrapable=False,
                reason=f"Blocked: known anti-scraping domain ({blocked}).",
                suggested_mode="blocked",
            )

    if not is_allowed(url, settings.crawler_user_agent):
        return ScrapeabilityResult(
            is_scrapable=False,
            reason="Linkout only: robots.txt disallows automated fetching.",
            suggested_mode="linkout_only",
        )

    headers = {
        "User-Agent": settings.crawler_user_agent,
        "Accept": "text/html,application/xhtml+xml,application/xml,text/xml,application/json",
    }

    try:
        with httpx.Client(timeout=10, follow_redirects=True, headers=headers) as client:
            response = client.get(url)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        return ScrapeabilityResult(
            is_scrapable=False,
            reason=f"Blocked: HTTP {exc.response.status_code} while probing.",
            suggested_mode="blocked",
        )
    except httpx.HTTPError as exc:
        return ScrapeabilityResult(
            is_scrapable=False,
            reason=f"Linkout only: probe failed ({exc.__class__.__name__}).",
            suggested_mode="linkout_only",
        )

    content_type = (response.headers.get("content-type") or "").lower()
    server = (response.headers.get("server") or "").lower()
    body = response.text[:8000].lower()

    if "cloudflare" in server or any(marker in body for marker in _BLOCK_MARKERS):
        return ScrapeabilityResult(
            is_scrapable=False,
            reason="Blocked: anti-bot protection or access challenge detected.",
            suggested_mode="blocked",
        )

    if "application/pdf" in content_type or "application/json" in content_type:
        return ScrapeabilityResult(
            is_scrapable=True,
            reason="Scrapable: structured document or API response detected.",
            suggested_mode="scrape",
        )

    if "xml" in content_type or "rss" in content_type:
        return ScrapeabilityResult(
            is_scrapable=True,
            reason="Scrapable: feed-like response detected.",
            suggested_mode="scrape",
        )

    if any(marker in body for marker in _JS_ONLY_MARKERS):
        return ScrapeabilityResult(
            is_scrapable=False,
            reason="Linkout only: page appears to require client-side JavaScript rendering.",
            suggested_mode="linkout_only",
        )

    if not content_type.startswith("text/html") and "html" not in content_type:
        return ScrapeabilityResult(
            is_scrapable=False,
            reason=f"Linkout only: unsupported content type '{content_type or 'unknown'}'.",
            suggested_mode="linkout_only",
        )

    if _looks_friendly(url):
        return ScrapeabilityResult(
            is_scrapable=True,
            reason="Scrapable: matches a source pattern that is usually crawler-friendly.",
            suggested_mode="scrape",
        )

    visible_text = " ".join(body.split())
    if len(visible_text) < 120:
        return ScrapeabilityResult(
            is_scrapable=False,
            reason="Linkout only: page returned too little readable text to parse reliably.",
            suggested_mode="linkout_only",
        )

    return ScrapeabilityResult(
        is_scrapable=True,
        reason="Scrapable: HTML page returned readable content.",
        suggested_mode="scrape",
    )
