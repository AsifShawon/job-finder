"""
OEP (Overseas Employment Policy / Probashi Kallyan Bank / related BD govt portals) connector.

Status: Stub — requires compliance review before activating.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.ingestion.connectors.base import BaseConnector
from app.ingestion.schemas import FetchedPage

if TYPE_CHECKING:
    from app.models.entities import Source

logger = logging.getLogger(__name__)


class OEPConnector(BaseConnector):
    """
    Stub for OEP connector.
    Implement discover_items() once the target URL and TOS are confirmed.
    """

    def discover_items(self, source: "Source", crawl_mode: str | None = None) -> list[FetchedPage]:
        logger.warning(
            "oep_connector_not_activated",
            extra={"source_id": source.id, "source_name": source.name},
        )
        return []
