from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.api.v1.endpoints.admin import crawl_runs, raw_documents
from app.ingestion.pipeline import PipelineResult, _derive_run_status
from app.models.enums import CrawlRunStatus


def test_all_skipped_run_is_partial_success() -> None:
    source = SimpleNamespace(compliance_status="allowed")
    result = PipelineResult(pages_fetched=93, skipped=93)

    status = _derive_run_status(source, result)

    assert status == CrawlRunStatus.partial_success


def test_successful_run_with_usable_outcomes_stays_success() -> None:
    source = SimpleNamespace(compliance_status="allowed")
    result = PipelineResult(pages_fetched=12, duplicates=5, skipped=7)

    status = _derive_run_status(source, result)

    assert status == CrawlRunStatus.success


def test_crawl_runs_response_exposes_structured_diagnostics() -> None:
    db = MagicMock()
    db.scalar.return_value = 1
    db.execute.return_value.all.return_value = [
        (
            SimpleNamespace(
                id=34,
                source_id=7,
                connector_key="successfactors_alfanar",
                source_type="jobs",
                ingestion_mode="crawl",
                crawl_mode="manual",
                status=CrawlRunStatus.partial_success,
                discovered_count=93,
                parsed_count=0,
                duplicate_count=0,
                draft_created_count=0,
                draft_updated_count=0,
                unchanged_count=0,
                skipped_count=93,
                failed_count=0,
                manual_review_count=0,
                started_at=datetime(2026, 5, 17, 16, 46, tzinfo=UTC),
                finished_at=datetime(2026, 5, 17, 16, 55, tzinfo=UTC),
                error_message=None,
                logs={
                    "messages": ["Discovered 93 pages"],
                    "diagnostics": {
                        "accepted_count": 0,
                        "published_count": 0,
                        "skipped_count": 93,
                        "dominant_skip_reason": "strict_missing_isc_category",
                        "confidence_summary": {"count": 93, "min": 0.31, "max": 0.61, "median": 0.44},
                        "skip_reasons": {"strict_missing_isc_category": 93},
                    },
                },
            ),
            "Alfanar Official Careers",
        )
    ]

    page = crawl_runs(db=db, _=MagicMock())

    assert page.total == 1
    assert page.items[0].status == CrawlRunStatus.partial_success
    assert page.items[0].skipped_count == 93
    assert page.items[0].diagnostics is not None
    assert page.items[0].diagnostics.skipped_count == 93
    assert page.items[0].diagnostics.dominant_skip_reason == "strict_missing_isc_category"
    assert page.items[0].diagnostics.confidence_summary["median"] == 0.44
    assert page.items[0].diagnostics.skip_reasons == {"strict_missing_isc_category": 93}


def test_raw_documents_response_includes_extraction_diagnostics() -> None:
    db = MagicMock()
    db.scalar.return_value = 1
    db.scalars.return_value.all.return_value = [
        SimpleNamespace(
            id=88,
            source_id=7,
            crawl_run_id=34,
            source_url="https://jobs.alfanar.com/alfanar/job/Riyadh-Site-Engineer/1",
            canonical_url="https://jobs.alfanar.com/alfanar/job/Riyadh-Site-Engineer/1",
            content_type="html",
            raw_title="Site Engineer",
            source_job_id="1",
            detected_item_type="job",
            skip_reason="strict_low_ai_confidence",
            raw_text="Apply now for site engineer.",
            raw_html_snapshot="<html></html>",
            raw_html_path="/tmp/raw.html",
            metadata_json={"company": "alfanar"},
            extraction_diagnostics_json={
                "attempts": [
                    {
                        "record_type": "job",
                        "extraction_confidence": 0.41,
                        "field_confidences": {"deadline_text": 0.0},
                        "evidence_snippets": ["Apply now"],
                        "application_url": "https://jobs.alfanar.com/apply/1",
                        "employer": "alfanar",
                        "country": "Saudi Arabia",
                        "title": "Site Engineer",
                        "summary": "Engineering role.",
                        "validation_errors": [],
                        "skip_reason": "strict_low_ai_confidence",
                    }
                ]
            },
            fetched_at=datetime(2026, 5, 17, 17, 0, tzinfo=UTC),
        )
    ]

    page = raw_documents(db=db, _=MagicMock(), crawl_run_id=34, skip_reason="strict_low_ai_confidence")

    assert page.total == 1
    assert page.items[0].crawl_run_id == 34
    assert page.items[0].extraction_diagnostics_json["attempts"][0]["skip_reason"] == "strict_low_ai_confidence"
