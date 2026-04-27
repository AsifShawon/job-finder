"""
BMET (Bureau of Manpower, Employment and Training) connector.

Official Bangladesh government source for manpower/migration data.
URL: http://www.bmet.org.bd

Status: Stub — requires manual compliance + TOS review before activating.
Until activated, this connector logs a warning and returns an empty list.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.ingestion.connectors.base import BaseConnector
from app.ingestion.schemas import FetchedPage

if TYPE_CHECKING:
    from app.models.entities import Source

logger = logging.getLogger(__name__)

_NOT_YET_ACTIVATED = (
    "BMET connector is not yet activated. "
    "Review bmet.org.bd robots.txt and terms of service, then implement discover_items()."
)


class BMETConnector(BaseConnector):
    """
    Stub for BMET (Bangladesh) connector.
    Set source.compliance_status='allowed' and implement discover_items() before use.
    """

    def discover_items(self, source: "Source", crawl_mode: str | None = None) -> list[FetchedPage]:
        logger.warning(
            "bmet_connector_not_activated",
            extra={"source_id": source.id, "source_name": source.name},
        )
        return []
