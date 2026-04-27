import xml.etree.ElementTree as ET
from datetime import datetime

import httpx

from app.core.config import get_settings
from app.ingestion.connectors.base import BaseSourceConnector
from app.ingestion.robots import is_allowed
from app.ingestion.schemas import FetchedPage
from app.models.entities import Source

settings = get_settings()


class RSSSourceConnector(BaseSourceConnector):
    def discover_items(self, source: Source, crawl_mode: str = "active_only") -> list[FetchedPage]:
        return self.fetch(source, since=None)

    def fetch(self, source: Source, since: datetime | None = None) -> list[FetchedPage]:
        if not is_allowed(source.base_url, settings.crawler_user_agent):
            return []
        with httpx.Client(timeout=20.0, headers={"User-Agent": settings.crawler_user_agent}) as client:
            resp = client.get(source.base_url)
            resp.raise_for_status()

        root = ET.fromstring(resp.text)
        pages: list[FetchedPage] = []
        for item in root.findall(".//item")[:50]:
            link = item.findtext("link")
            title = item.findtext("title")
            description = item.findtext("description")
            pages.append(
                FetchedPage(
                    url=link or source.base_url,
                    canonical_url=link,
                    title=title,
                    raw_text=description,
                    metadata={"rss": True},
                    extracted_links=[link] if link else [],
                )
            )
        return pages
