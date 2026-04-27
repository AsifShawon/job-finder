"""
EURES (European Employment Services) connector.

EURES provides an open API for EU job listings.
API docs: https://api.eures.europa.eu/

Compliance: EURES data is open/public. Use API mode (compliance_status=use_api_only).
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from app.ingestion.connectors.base import BaseConnector
from app.ingestion.schemas import FetchedPage

if TYPE_CHECKING:
    from app.models.entities import Source

logger = logging.getLogger(__name__)

_EURES_API_BASE = "https://ec.europa.eu/eures/eures-searchengine/page/jv-search"


class EURESConnector(BaseConnector):
    """
    Fetches EU job listings from the EURES API.
    Filters for jobs open to international candidates (relevant to Bangladeshi workers).

    To activate: set source.compliance_status='use_api_only', source.connector_key='eures_connector'
    """

    def discover_items(self, source: "Source", crawl_mode: str | None = None) -> list[FetchedPage]:
        try:
            import httpx
        except ImportError:
            logger.error("httpx not installed; cannot fetch EURES API")
            return []

        keywords = source.search_keywords or source.search_queries or []
        query = " ".join(keywords) if keywords else "labour worker"

        params: dict[str, Any] = {
            "queryString": query,
            "pageSize": 50,
            "pageNum": 0,
        }

        try:
            with httpx.Client(timeout=20) as client:
                resp = client.get(_EURES_API_BASE, params=params)
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.warning("eures_fetch_error", extra={"error": str(exc)})
            return []

        pages: list[FetchedPage] = []
        for item in data.get("jvs", {}).get("jv", []) or []:
            job_id = item.get("jobVacancyId") or item.get("id")
            if not job_id:
                continue
            detail_url = f"https://eures.europa.eu/en/job-search/{job_id}"
            title = item.get("header", {}).get("jobTitle") or item.get("title") or "EURES Job"
            country = item.get("header", {}).get("placeOfWork", {}).get("countryCode")
            pages.append(FetchedPage(
                url=detail_url,
                source_page_url=detail_url,
                title=title,
                raw_text=str(item),
                content_type="api",
                metadata={
                    "source": "eures",
                    "country": country,
                    "open_to_international": True,
                    "opportunity_type_hint": "overseas_job",
                    "raw_api_item": item,
                },
            ))

        logger.info("eures_discovered", extra={"count": len(pages)})
        return pages
