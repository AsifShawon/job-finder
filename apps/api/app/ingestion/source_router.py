"""
Routes a Source to the correct connector class.

Priority:
  1. Explicit connector_key  (most specific)
  2. ingestion_mode mapping
  3. Legacy access_method fallback

Compliance checks are enforced here:
  - linkout_only  → only LinkoutConnector
  - use_api_only  → only API/RSS/open_data connectors
  - rss_only      → only RSSConnector
  - manual_review_required → block entirely
"""
from __future__ import annotations

from typing import TYPE_CHECKING

import logging

from app.ingestion.connectors.base import BaseConnector
from app.ingestion.compliance_guard import ComplianceError
from app.ingestion.errors import SourceConfigError

if TYPE_CHECKING:
    from app.models.entities import Source

logger = logging.getLogger(__name__)

# Connectors allowed when compliance_status = use_api_only
_API_SAFE_CONNECTORS = {
    "generic_rss", "usa_jobs_api", "reliefweb_api", "eures_connector",
    "jobbank_linkout", "linkout_only",
}

# Connectors allowed when compliance_status = rss_only
_RSS_SAFE_CONNECTORS = {"generic_rss", "linkout_only"}


def get_connector(source: "Source") -> BaseConnector:
    from app.ingestion.connectors.registry import CONNECTOR_KEY_MAP, LEGACY_MAP

    CONNECTOR_REGISTRY = CONNECTOR_KEY_MAP

    compliance = (source.compliance_status or "unknown").lower()
    connector_key = source.connector_key

    # ── Hard compliance blocks ─────────────────────────────────────────────────
    if compliance == "linkout_only" or (source.ingestion_mode == "linkout_only"):
        from app.ingestion.connectors.linkout_connector import LinkoutConnector
        logger.info(
            "source_router_linkout_only",
            extra={"source_id": source.id, "connector_key": connector_key},
        )
        return LinkoutConnector()

    if compliance == "manual_review_required":
        raise ComplianceError(
            f"Source '{source.name}' has compliance_status=manual_review_required. "
            "A human must approve crawling this source."
        )

    # ── use_api_only: only allow API/RSS/open_data connectors ─────────────────
    if compliance == "use_api_only":
        if connector_key and connector_key not in _API_SAFE_CONNECTORS:
            raise ComplianceError(
                f"Source '{source.name}' requires API-only access but connector_key='{connector_key}' "
                "is not an API/RSS connector."
            )
        if not connector_key:
            # Force to API connector
            from app.ingestion.connectors.api_connector import APISourceConnector
            logger.info(
                "source_router_forced_api",
                extra={"source_id": source.id},
            )
            return APISourceConnector()

    # ── rss_only: only allow RSS connector ────────────────────────────────────
    if compliance == "rss_only":
        if connector_key and connector_key not in _RSS_SAFE_CONNECTORS:
            raise ComplianceError(
                f"Source '{source.name}' is rss_only but connector_key='{connector_key}' is not an RSS connector."
            )
        if not connector_key:
            from app.ingestion.connectors.rss_connector import RSSSourceConnector
            logger.info(
                "source_router_forced_rss",
                extra={"source_id": source.id},
            )
            return RSSSourceConnector()

    # ── 1. Prefer explicit connector_key ──────────────────────────────────────
    if connector_key:
        cls = CONNECTOR_REGISTRY.get(connector_key)
        if not cls:
            raise SourceConfigError(
                f"Unknown connector_key '{connector_key}' for source '{source.name}'."
            )
        logger.info(
            "source_router_connector_key",
            extra={"source_id": source.id, "connector_key": connector_key},
        )
        return cls()

    # ── 2. feed_type routing (new — 4 simple values) ─────────────────────────
    if source.feed_type:
        feed_map = {
            "rss": "rss",
            "api": "api",
            "pdf": "pdf",
            "html": "static_html",
        }
        legacy_key = feed_map.get(source.feed_type)
        if legacy_key:
            cls = LEGACY_MAP.get(legacy_key)
            if cls:
                logger.info(
                    "source_router_feed_type",
                    extra={"source_id": source.id, "feed_type": source.feed_type},
                )
                return cls()

    # ── 3. ingestion_mode routing ─────────────────────────────────────────────
    mode = source.ingestion_mode or ""
    mode_map = {
        "rss": "rss",
        "api": "api",
        "open_data": "api",
        "html": "static_html",
        "html_with_pdf": "static_html",
        "pdf": "pdf",
        "dynamic_html": "dynamic_html",
        "manual": "static_html",
        "linkout_only": "linkout_only",
    }
    legacy_key = mode_map.get(mode)
    if legacy_key:
        cls = LEGACY_MAP.get(legacy_key)
        if cls:
            logger.info(
                "source_router_ingestion_mode",
                extra={"source_id": source.id, "ingestion_mode": mode, "legacy_key": legacy_key},
            )
            return cls()

    # ── 3. Legacy access_method fallback ─────────────────────────────────────
    access = source.access_method.value if source.access_method else "static_html"
    cls = LEGACY_MAP.get(access)
    if cls:
        logger.info(
            "source_router_access_method",
            extra={"source_id": source.id, "access_method": access},
        )
        return cls()

    from app.ingestion.connectors.static_html_connector import StaticHTMLConnector
    logger.info("source_router_fallback", extra={"source_id": source.id})
    return StaticHTMLConnector()
