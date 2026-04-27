from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import TYPE_CHECKING

from app.ingestion.schemas import FetchedPage, ParsedItem, OpportunityDraftPayload

if TYPE_CHECKING:
    from app.models.entities import Source


class BaseConnector(ABC):
    """
    All connectors must implement these three methods.
    normalize() is optional — the pipeline uses it when the connector
    can produce a richer payload than the generic LLM extractor.
    """

    connector_key: str = "base"

    @abstractmethod
    def discover_items(self, source: "Source", crawl_mode: str = "active_only") -> list[FetchedPage]:
        """Return a list of raw fetched pages/items for this source."""
        raise NotImplementedError

    def parse_item(self, raw_item: FetchedPage, source: "Source") -> ParsedItem:
        """Parse a FetchedPage into a structured ParsedItem."""
        return ParsedItem(
            title=raw_item.title,
            body_text=raw_item.raw_text or "",
            source_page_url=raw_item.source_page_url or raw_item.url,
            document_url=raw_item.document_url,
            original_apply_url=raw_item.original_apply_url,
            content_type=raw_item.content_type,
            metadata=raw_item.metadata,
        )

    def normalize(self, parsed_item: ParsedItem, source: "Source") -> OpportunityDraftPayload | ParsedItem:
        """Optionally normalize a ParsedItem into an OpportunityDraftPayload."""
        return parsed_item

    def validate(self, draft_payload: OpportunityDraftPayload | ParsedItem) -> bool:
        """Return True if the payload is valid; False otherwise."""
        title = getattr(draft_payload, "title", None)
        body_text = getattr(draft_payload, "body_text", None)
        return bool(title or body_text)

    # Legacy compat — old connectors use fetch(); new ones use discover_items()
    def fetch(self, source: "Source", since: datetime | None = None) -> list[FetchedPage]:
        return self.discover_items(source, crawl_mode="active_only")


# Backward-compat alias
BaseSourceConnector = BaseConnector
