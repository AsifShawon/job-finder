"""
USAJobs API connector.

USAJOBS provides a public REST API for US federal government job listings.
API docs: https://developer.usajobs.gov/

Compliance: Public API — use API key. Set compliance_status='use_api_only'.
Note: Most US federal jobs require US citizenship; always mark requires_existing_work_permit=True.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.ingestion.connectors.base import BaseConnector
from app.ingestion.schemas import FetchedPage

if TYPE_CHECKING:
    from app.models.entities import Source

logger = logging.getLogger(__name__)

_API_BASE = "https://data.usajobs.gov/api/search"


class USAJobsAPIConnector(BaseConnector):
    """
    Fetches US federal jobs via USAJOBS API.
    Requires USAJOBS_API_KEY and USAJOBS_USER_AGENT env vars.

    Most items will be authorized_workers_only; eligibility engine handles this.
    """

    def discover_items(self, source: "Source", crawl_mode: str | None = None) -> list[FetchedPage]:
        import os
        try:
            import httpx
        except ImportError:
            logger.error("httpx not installed")
            return []

        api_key = os.getenv("USAJOBS_API_KEY", "")
        user_agent = os.getenv("USAJOBS_USER_AGENT", "bd-opportunity-platform")
        if not api_key:
            logger.warning("usajobs_no_api_key")
            return []

        keywords = source.search_keywords or source.search_queries or []
        keyword = " ".join(keywords) if keywords else "foreign national"

        headers = {
            "Authorization-Key": api_key,
            "User-Agent": user_agent,
            "Host": "data.usajobs.gov",
        }
        params = {"Keyword": keyword, "ResultsPerPage": 25, "Page": 1}

        try:
            with httpx.Client(timeout=20) as client:
                resp = client.get(_API_BASE, headers=headers, params=params)
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.warning("usajobs_fetch_error", extra={"error": str(exc)})
            return []

        pages: list[FetchedPage] = []
        for item in data.get("SearchResult", {}).get("SearchResultItems", []):
            matched = item.get("MatchedObjectDescriptor", {})
            position_url = matched.get("PositionURI") or matched.get("ApplyURI", [""])[0]
            title = matched.get("PositionTitle", "US Federal Job")
            pages.append(FetchedPage(
                url=position_url,
                source_page_url=position_url,
                original_apply_url=position_url,
                title=title,
                raw_text=str(matched),
                content_type="api",
                metadata={
                    "source": "usajobs",
                    "country": "United States",
                    "authorized_workers_only": True,
                    "opportunity_type_hint": "overseas_job",
                    "raw_api_item": matched,
                },
            ))

        logger.info("usajobs_discovered", extra={"count": len(pages)})
        return pages
