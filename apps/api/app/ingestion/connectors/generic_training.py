"""
Generic training connector.
Fetches skill-training opportunity pages using standard HTML parsing.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from app.ingestion.connectors.static_html_connector import StaticHTMLConnector
from app.ingestion.schemas import FetchedPage, ParsedItem

if TYPE_CHECKING:
    from app.models.entities import Source


class GenericTrainingConnector(StaticHTMLConnector):
    """
    Extends StaticHTMLConnector with training-specific hints:
    - Forces opportunity_type = training in metadata
    - Extracts training duration, certificate, and enrollment info if present
    """

    def discover_items(self, source: "Source", crawl_mode: str | None = None) -> list[FetchedPage]:
        pages = super().discover_items(source, crawl_mode)
        for page in pages:
            page.metadata.setdefault("opportunity_type_hint", "training")
        return pages

    def parse_item(self, raw_item: FetchedPage, source: "Source") -> ParsedItem:
        item = super().parse_item(raw_item, source)
        item.extra["opportunity_type"] = "training"
        return item
