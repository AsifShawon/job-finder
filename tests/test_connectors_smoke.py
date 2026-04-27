from __future__ import annotations

from pathlib import Path
import re

import pytest

from app.ingestion.compliance_guard import ComplianceError
from app.ingestion.connectors.boesl_brms_connector import BOESLBRMSConnector
from app.ingestion.connectors.generic_scholarship_connector import GenericScholarshipConnector
from app.ingestion.connectors.registry import CONNECTOR_KEY_MAP
from app.ingestion.connectors.reliefweb_api import _API_BASE
from app.ingestion.errors import SourceConfigError
from app.ingestion.source_router import get_connector
from app.models.entities import Source
from app.models.enums import AccessMethod, SourceClass, TrustTier
from worker.tasks import BaseRetryTask


def _make_source(**overrides) -> Source:
    data = {
        "name": "Test Source",
        "base_url": "https://example.com",
        "root_url": "https://example.com",
        "source_class": SourceClass.news_policy,
        "trust_tier": TrustTier.news_only,
        "access_method": AccessMethod.static_html,
        "crawl_frequency_minutes": 1440,
    }
    data.update(overrides)
    return Source(**data)


def test_all_registered_connectors_instantiate() -> None:
    for key, cls in CONNECTOR_KEY_MAP.items():
        instance = cls()
        assert instance is not None, f"Connector {key} failed to instantiate"


def test_boesl_brms_discover_items_returns_list(monkeypatch: pytest.MonkeyPatch) -> None:
    connector = BOESLBRMSConnector()
    monkeypatch.setattr(connector, "fetch", lambda *_args, **_kwargs: [])
    items = connector.discover_items(_make_source())
    assert isinstance(items, list)


def test_generic_scholarship_discover_items_returns_list(monkeypatch: pytest.MonkeyPatch) -> None:
    connector = GenericScholarshipConnector()
    monkeypatch.setattr(connector, "fetch", lambda *_args, **_kwargs: [])
    items = connector.discover_items(_make_source())
    assert isinstance(items, list)


def test_reliefweb_connector_uses_v2_endpoint() -> None:
    assert _API_BASE.endswith("/v2/jobs")


def test_source_router_unknown_connector_raises_source_config_error() -> None:
    source = _make_source(connector_key="unknown_connector")
    with pytest.raises(SourceConfigError):
        get_connector(source)


def test_linkout_source_routes_to_linkout_connector() -> None:
    source = _make_source(compliance_status="linkout_only")
    connector = get_connector(source)
    assert connector.__class__.__name__ == "LinkoutConnector"


def test_logger_calls_do_not_raise_type_error() -> None:
    root = Path(__file__).resolve().parents[1]
    pattern = re.compile(
        r"logger\.(debug|info|warning|error)\([^\n]*"
        r"(source_id|error|url|status|connector|task_id|crawl_run_id)\s*="
    )
    for folder in (root / "apps" / "api" / "app", root / "apps" / "worker"):
        for path in folder.rglob("*.py"):
            text = path.read_text(encoding="utf-8")
            assert not pattern.search(text), f"Found unsafe logger kwargs in {path}"


def test_compliance_error_not_retried() -> None:
    assert ComplianceError in BaseRetryTask.dont_autoretry_for
