"""
ReliefWeb API connector.

ReliefWeb (OCHA) provides a free, open API for humanitarian jobs and migration policy updates.
API docs: https://reliefweb.int/help/api

Compliance: Fully open API — no scraping, no auth required.
Set compliance_status='use_api_only', connector_key='reliefweb_api'.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.core.config import get_settings
from app.ingestion.connectors.base import BaseConnector
from app.ingestion.schemas import FetchedPage

if TYPE_CHECKING:
    from app.models.entities import Source

logger = logging.getLogger(__name__)

_API_BASE = "https://api.reliefweb.int/v2/jobs"
settings = get_settings()


class ReliefWebAPIConnector(BaseConnector):
    """
    Fetches jobs and opportunities from ReliefWeb API.
    Particularly useful for migration/humanitarian roles open to international applicants.
    """

    def discover_items(self, source: "Source", crawl_mode: str | None = None) -> list[FetchedPage]:
        try:
            import httpx
        except ImportError:
            logger.error("httpx not installed")
            return []

        keywords = source.search_keywords or source.search_queries or []
        country_filter = source.country or ""

        payload: dict = {
            "appname": settings.reliefweb_appname,
            "fields": {"include": ["title", "url", "date", "country", "source", "body", "career_categories"]},
            "filter": {"field": "country.name", "value": country_filter} if country_filter else {},
            "limit": 50,
            "sort": ["date.created:desc"],
        }
        if keywords:
            payload["query"] = {"value": " ".join(keywords), "operator": "AND"}

        try:
            with httpx.Client(timeout=20) as client:
                resp = client.post(_API_BASE, json=payload)
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.warning("reliefweb_fetch_error", extra={"error": str(exc)})
            return []

        pages: list[FetchedPage] = []
        for item in data.get("data", []):
            fields = item.get("fields", {})
            url = fields.get("url") or f"https://reliefweb.int/job/{item.get('id')}"
            title = fields.get("title") or "ReliefWeb Job"
            country_list = [c.get("name") for c in (fields.get("country") or []) if c.get("name")]
            date_fields = fields.get("date") or {}
            pages.append(FetchedPage(
                url=url,
                source_page_url=url,
                original_apply_url=url,
                title=title,
                raw_text=fields.get("body") or str(fields),
                content_type="api",
                metadata={
                    "source": "reliefweb",
                    "created_at": date_fields.get("created"),
                    "closing_at": date_fields.get("closing"),
                    "countries": country_list,
                    "open_to_international": True,
                    "opportunity_type_hint": "overseas_job",
                    "raw_api_item": fields,
                },
            ))

        logger.info("reliefweb_discovered", extra={"count": len(pages)})
        return pages
