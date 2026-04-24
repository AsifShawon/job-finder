from datetime import datetime

import httpx
import trafilatura

from app.core.config import get_settings
from app.ingestion.connectors.base import BaseSourceConnector
from app.ingestion.robots import is_allowed
from app.ingestion.schemas import FetchedPage
from app.models.entities import Source

settings = get_settings()


class PDFNoticeConnector(BaseSourceConnector):
    def fetch(self, source: Source, since: datetime | None = None) -> list[FetchedPage]:
        if not is_allowed(source.base_url, settings.crawler_user_agent):
            return []
        with httpx.Client(timeout=20.0, headers={"User-Agent": settings.crawler_user_agent}) as client:
            resp = client.get(source.base_url)
            resp.raise_for_status()

        extracted = trafilatura.extract(resp.text) or resp.text[:5000]
        return [
            FetchedPage(
                url=source.base_url,
                canonical_url=source.base_url,
                title="PDF Notice",
                raw_text=extracted,
                metadata={"content_type": resp.headers.get("content-type")},
                extracted_links=[],
            )
        ]
