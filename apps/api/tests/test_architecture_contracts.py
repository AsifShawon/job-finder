"""
Phase 13: Architecture contract tests.

Covers four critical invariants:
  1. SourceRouter routing — correct connector per key/compliance
  2. Deduplication — same content_hash not double-ingested
  3. Eligibility engine — BOESL gets can_apply_from_bd=True + gov badge
  4. Review gate — pipeline NEVER sets is_active=True or review_status='approved'
"""
from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock, patch

import pytest

# ── 1. SourceRouter routing ────────────────────────────────────────────────────

def _make_source(**kwargs) -> MagicMock:
    """Build a minimal mock Source with sensible defaults."""
    src = MagicMock()
    src.name = kwargs.get("name", "Test Source")
    src.compliance_status = kwargs.get("compliance_status", "allowed")
    src.connector_key = kwargs.get("connector_key", None)
    src.ingestion_mode = kwargs.get("ingestion_mode", None)
    src.access_method = kwargs.get("access_method", MagicMock(value="static_html"))
    return src


def test_router_boesl_brms_gets_correct_connector() -> None:
    from app.ingestion.connectors.boesl_brms_connector import BOESLBRMSConnector
    from app.ingestion.source_router import get_connector

    src = _make_source(connector_key="boesl_brms")
    connector = get_connector(src)
    assert isinstance(connector, BOESLBRMSConnector)


def test_router_linkout_compliance_always_gets_linkout_connector() -> None:
    from app.ingestion.connectors.linkout_connector import LinkoutConnector
    from app.ingestion.source_router import get_connector

    # Even with a non-linkout connector_key, compliance=linkout_only wins
    src = _make_source(compliance_status="linkout_only", connector_key="generic_news")
    connector = get_connector(src)
    assert isinstance(connector, LinkoutConnector)


def test_router_use_api_only_blocks_html_connector() -> None:
    from app.ingestion.compliance_guard import ComplianceError
    from app.ingestion.source_router import get_connector

    src = _make_source(compliance_status="use_api_only", connector_key="generic_news")
    with pytest.raises(ComplianceError):
        get_connector(src)


def test_router_use_api_only_allows_rss_connector() -> None:
    from app.ingestion.connectors.rss_connector import RSSSourceConnector
    from app.ingestion.source_router import get_connector

    src = _make_source(compliance_status="use_api_only", connector_key="generic_rss")
    connector = get_connector(src)
    assert isinstance(connector, RSSSourceConnector)


def test_router_manual_review_required_raises() -> None:
    from app.ingestion.compliance_guard import ComplianceError
    from app.ingestion.source_router import get_connector

    src = _make_source(compliance_status="manual_review_required")
    with pytest.raises(ComplianceError):
        get_connector(src)


def test_router_rss_only_blocks_non_rss_connector() -> None:
    from app.ingestion.compliance_guard import ComplianceError
    from app.ingestion.source_router import get_connector

    src = _make_source(compliance_status="rss_only", connector_key="generic_pdf")
    with pytest.raises(ComplianceError):
        get_connector(src)


def test_router_dynamic_html_mode_gets_dynamic_connector() -> None:
    from app.ingestion.connectors.dynamic_html_connector import DynamicHTMLConnector
    from app.ingestion.source_router import get_connector

    src = _make_source(ingestion_mode="dynamic_html")
    connector = get_connector(src)
    assert isinstance(connector, DynamicHTMLConnector)


# ── 2. Deduplication ───────────────────────────────────────────────────────────

def test_is_opportunity_duplicate_returns_true_for_existing_hash() -> None:
    from app.ingestion.validators import is_opportunity_duplicate

    db = MagicMock()
    db.scalar.return_value = MagicMock()  # non-None → duplicate found
    assert is_opportunity_duplicate(db, "abc123") is True


def test_is_opportunity_duplicate_returns_false_for_new_hash() -> None:
    from app.ingestion.validators import is_opportunity_duplicate

    db = MagicMock()
    db.scalar.return_value = None
    assert is_opportunity_duplicate(db, "new_hash_xyz") is False


def test_is_duplicate_checks_canonical_url_first() -> None:
    from app.ingestion.validators import is_duplicate

    db = MagicMock()
    db.scalar.return_value = MagicMock()  # found by URL
    result = is_duplicate(db, canonical_url="https://example.com/job/1", content_hash="h", title="t")
    assert result is True


# ── 3. Eligibility engine ──────────────────────────────────────────────────────

def test_eligibility_boesl_brms_sets_gov_badge_and_can_apply() -> None:
    from app.ingestion.eligibility_engine import tag_eligibility

    result = tag_eligibility(
        source_connector_key="boesl_brms",
        record_type="job",
        title="BOESL Job",
        country="Malaysia",
    )

    assert result.can_apply_from_bd is True
    assert result.source_trust_badge == "সরকারি উৎস"
    assert result.eligibility_status == "eligible"


def test_eligibility_international_open_sets_conditional() -> None:
    from app.ingestion.eligibility_engine import tag_eligibility

    result = tag_eligibility(
        source_connector_key="reliefweb_api",
        record_type="job",
        title="Global Role",
        eligibility_text="open to international candidates",
    )

    assert result.eligibility_status == "conditional"
    assert result.open_to_international_candidates is True


def test_eligibility_authorized_workers_only_status() -> None:
    from app.ingestion.eligibility_engine import tag_eligibility

    result = tag_eligibility(
        source_connector_key="usa_jobs_api",
        record_type="job",
        title="TFWP Role",
        eligibility_text="authorized workers only, no sponsorship available",
    )

    assert result.eligibility_status == "authorized_workers_only"
    assert result.open_to_authorized_workers_only is True


def test_eligibility_unknown_source_gets_unclear_status() -> None:
    from app.ingestion.eligibility_engine import tag_eligibility

    result = tag_eligibility(
        source_connector_key="generic_news",
        record_type="job",
        title="Mystery Role",
    )

    assert result.eligibility_status == "unclear_manual_review"
    assert result.source_trust_badge is None


# ── 4. Review gate — pipeline never auto-publishes ────────────────────────────

def test_pipeline_source_sets_is_active_false_in_code() -> None:
    """The pipeline source code must never set is_active=True for drafts."""
    import inspect
    import app.ingestion.pipeline as pipeline_module

    source_lines = inspect.getsource(pipeline_module._process_page)

    # Must contain is_active=False
    assert "is_active=False" in source_lines, (
        "_process_page must set is_active=False on every created draft"
    )
    # Must contain review_status='pending'
    assert 'review_status="pending"' in source_lines or "review_status='pending'" in source_lines, (
        "_process_page must set review_status='pending'"
    )
    # Must contain needs_admin_review=True
    assert "needs_admin_review=True" in source_lines, (
        "_process_page must set needs_admin_review=True"
    )


def test_pipeline_does_not_create_published_opportunity() -> None:
    """ProcessPage must not touch published_opportunities table."""
    import inspect
    import app.ingestion.pipeline as pipeline_module

    source_lines = inspect.getsource(pipeline_module._process_page)
    assert "PublishedOpportunity" not in source_lines, (
        "_process_page must not create PublishedOpportunity rows — only admin approve can do that"
    )


def test_review_gate_pending_draft_not_in_search_results() -> None:
    """Search service must filter on is_active=True, which pending drafts never have."""
    from app.services.search_service import _apply_filters
    from app.schemas.opportunity import PublishedSearchQuery
    from sqlalchemy import select
    from app.models.entities import PublishedOpportunity

    q = PublishedSearchQuery(q="test")
    stmt = select(PublishedOpportunity)
    filtered = _apply_filters(stmt, q, user_id=None)

    # The compiled WHERE clause must include is_active filter
    compiled = str(filtered.whereclause.compile(compile_kwargs={"literal_binds": True}))
    assert "is_active" in compiled, "Search must always filter on is_active"
