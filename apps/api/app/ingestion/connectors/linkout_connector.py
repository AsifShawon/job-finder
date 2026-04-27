"""
Linkout-only connector — returns zero pages.
Used when compliance_status=linkout_only; the compliance_guard should have
already blocked scraping before this point, but this is the safety net.
"""
from __future__ import annotations

from datetime import datetime

from app.ingestion.connectors.base import BaseSourceConnector
from app.ingestion.schemas import FetchedPage
from app.models.entities import Source


class LinkoutConnector(BaseSourceConnector):
    def discover_items(self, source: Source, crawl_mode: str = "active_only") -> list[FetchedPage]:
        return []

    def fetch(self, source: Source, since: datetime | None = None) -> list[FetchedPage]:
        return []
