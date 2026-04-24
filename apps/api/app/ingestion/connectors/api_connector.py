from datetime import datetime

import httpx

from app.core.config import get_settings
from app.ingestion.connectors.base import BaseSourceConnector
from app.ingestion.robots import is_allowed
from app.ingestion.schemas import FetchedPage
from app.models.entities import Source

settings = get_settings()


class APISourceConnector(BaseSourceConnector):
    def fetch(self, source: Source, since: datetime | None = None) -> list[FetchedPage]:
        if not is_allowed(source.base_url, settings.crawler_user_agent):
            return []
        with httpx.Client(timeout=20.0, headers={"User-Agent": settings.crawler_user_agent}) as client:
            resp = client.get(source.base_url)
            resp.raise_for_status()
            data = resp.json()
        items: list[FetchedPage] = []
        records = data if isinstance(data, list) else data.get("items", [])
        for item in records[:50]:
            url = item.get("url") or source.base_url
            items.append(
                FetchedPage(
                    url=url,
                    canonical_url=item.get("canonical_url"),
                    title=item.get("title"),
                    raw_text=str(item),
                    metadata=item,
                    extracted_links=[],
                )
            )
        return items
