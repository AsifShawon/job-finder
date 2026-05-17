from __future__ import annotations

from unittest.mock import MagicMock

from app.ingestion.pipeline import PipelineResult, _extract_records_for_page, _process_page
from app.ingestion.schemas import FetchedPage, JobOpportunityExtraction
from app.models.entities import Opportunity, RawDocument, Source
from app.models.enums import AccessMethod, SourceClass, TrustTier


def _make_source() -> Source:
    return Source(
        name="Example Jobs",
        base_url="https://jobs.example.com/",
        root_url="https://jobs.example.com/",
        connector_key="search_html_jobs",
        requires_admin_review=True,
        auto_publish=False,
        trust_level="verified_source",
        source_class=SourceClass.news_policy,
        trust_tier=TrustTier.news_only,
        access_method=AccessMethod.static_html,
        crawl_frequency_minutes=1440,
    )


def _make_strict_source() -> Source:
    source = _make_source()
    source.connector_key = "tamimi_careers"
    source.settings_json = {
        "strict_bd_job_filter": True,
        "force_ai_detail_extraction": True,
        "require_application_url": True,
        "require_isc_category": True,
        "auto_publish_on_pass": True,
    }
    return source


def _make_page() -> FetchedPage:
    return FetchedPage(
        url="https://jobs.example.com/jobs",
        canonical_url="https://jobs.example.com/jobs",
        title="Current vacancies",
        raw_html="<html><body><h1>Vacancies</h1><p>Apply now</p></body></html>",
        content_type="html",
    )


def _make_db() -> MagicMock:
    db = MagicMock()
    counter = {"raw": 0, "opp": 0}

    def add(obj):
        if isinstance(obj, RawDocument):
            counter["raw"] += 1
            obj.id = counter["raw"]
        if isinstance(obj, Opportunity):
            counter["opp"] += 1
            obj.id = counter["opp"]

    db.add.side_effect = add
    db.flush.side_effect = lambda: None
    db.execute.side_effect = lambda *_args, **_kwargs: None
    return db


def test_process_page_creates_multiple_opportunities(monkeypatch) -> None:
    db = _make_db()
    source = _make_source()
    page = _make_page()
    crawl_run = MagicMock(id=99)
    storage = MagicMock()
    storage.put_text.return_value = "/tmp/raw.html"

    monkeypatch.setattr("app.ingestion.pipeline.is_latest_snapshot_duplicate", lambda *args, **kwargs: False)
    monkeypatch.setattr(
        "app.ingestion.pipeline._extract_records_for_page",
        lambda *_args, **_kwargs: [
            JobOpportunityExtraction(
                title="Welder",
                title_bn="ওয়েল্ডার",
                summary="Welder role",
                summary_en="Welder role in Japan.",
                summary_bn="জাপানে ওয়েল্ডার পদ।",
                country="Japan",
                employer="ABC Co",
                application_url="https://jobs.example.com/apply/1",
                requirements=["Valid passport required"],
                extraction_confidence=0.9,
            ),
            JobOpportunityExtraction(
                title="Driver",
                title_bn="ড্রাইভার",
                summary="Driver role",
                summary_en="Driver role in Japan.",
                summary_bn="জাপানে ড্রাইভার পদ।",
                country="Japan",
                employer="ABC Co",
                application_url="https://jobs.example.com/apply/2",
                requirements=["Driving license required"],
                extraction_confidence=0.86,
            ),
        ],
    )
    monkeypatch.setattr("app.ingestion.pipeline.find_existing_opportunity", lambda *args, **kwargs: None)

    result = PipelineResult()
    _process_page(
        db=db,
        page=page,
        source=source,
        crawl_run=crawl_run,
        storage=storage,
        parser=lambda current_page: {"title": current_page.title},
        trust_badge="যাচাইকৃত উৎস",
        result=result,
        logs=[],
    )

    created = [call.args[0] for call in db.add.call_args_list if isinstance(call.args[0], Opportunity)]
    assert len(created) == 2
    assert result.draft_created == 2
    assert all(item.source_page_url == "https://jobs.example.com/jobs" for item in created)
    assert all(item.source_item_key for item in created)


def test_process_page_skips_ai_for_unchanged_snapshot(monkeypatch) -> None:
    db = _make_db()
    source = _make_source()
    page = _make_page()
    crawl_run = MagicMock(id=100)
    storage = MagicMock()
    storage.put_text.return_value = "/tmp/raw.html"

    called = {"extract": False}

    def _marker(*_args, **_kwargs):
        called["extract"] = True
        return []

    monkeypatch.setattr("app.ingestion.pipeline.is_latest_snapshot_duplicate", lambda *args, **kwargs: True)
    monkeypatch.setattr("app.ingestion.pipeline._extract_records_for_page", _marker)

    result = PipelineResult()
    _process_page(
        db=db,
        page=page,
        source=source,
        crawl_run=crawl_run,
        storage=storage,
        parser=lambda current_page: {"title": current_page.title},
        trust_badge="যাচাইকৃত উৎস",
        result=result,
        logs=[],
    )

    assert called["extract"] is False
    assert result.duplicates == 1


def test_strict_official_structured_page_uses_ai_extraction(monkeypatch) -> None:
    db = _make_db()
    source = _make_strict_source()
    page = FetchedPage(
        url="https://tamimi.sa/job/electrical-supervisor",
        canonical_url="https://tamimi.sa/job/electrical-supervisor",
        title="Electrical Supervisor",
        raw_html="<html></html>",
        raw_text="Apply now. Requirements: experience.",
        content_type="html",
        original_apply_url="https://tamimi.sa/job/electrical-supervisor",
        metadata={"structured_job": True, "company": "Tamimi", "location_raw": "Dammam, Saudi Arabia"},
    )
    called = {"ai": False, "structured": False}

    def fake_extract_structured(*_args, **_kwargs):
        called["ai"] = True
        return JobOpportunityExtraction(
            title="Electrical Supervisor",
            summary="Supervisor role",
            country="Saudi Arabia",
            employer="Tamimi",
            application_url="https://tamimi.sa/job/electrical-supervisor",
            requirements=["2 years experience"],
            extraction_confidence=0.82,
        )

    def fail_structured(*_args, **_kwargs):
        called["structured"] = True
        raise AssertionError("_structured_page_extraction should not be used")

    monkeypatch.setattr("app.ingestion.pipeline.extract_structured", fake_extract_structured)
    monkeypatch.setattr("app.ingestion.pipeline._structured_page_extraction", fail_structured)

    records = _extract_records_for_page(db, source, page, {"title": page.title, "body_text": page.raw_text})

    assert called["ai"] is True
    assert called["structured"] is False
    assert len(records) == 1
    assert records[0].application_url == "https://tamimi.sa/job/electrical-supervisor"


def test_strict_official_job_without_apply_url_is_skipped(monkeypatch) -> None:
    db = _make_db()
    source = _make_strict_source()
    page = _make_page()
    crawl_run = MagicMock(id=101)
    storage = MagicMock()
    storage.put_text.return_value = "/tmp/raw.html"

    monkeypatch.setattr("app.ingestion.pipeline.is_latest_snapshot_duplicate", lambda *args, **kwargs: False)
    monkeypatch.setattr(
        "app.ingestion.pipeline._extract_records_for_page",
        lambda *_args, **_kwargs: [
            JobOpportunityExtraction(
                title="General Worker",
                summary="Worker role in Saudi Arabia.",
                country="Saudi Arabia",
                employer="Tamimi",
                requirements=["Basic fitness required"],
                extraction_confidence=0.8,
            )
        ],
    )

    result = PipelineResult()
    _process_page(
        db=db,
        page=page,
        source=source,
        crawl_run=crawl_run,
        storage=storage,
        parser=lambda current_page: {"title": current_page.title},
        trust_badge="অফিসিয়াল পার্টনার",
        result=result,
        logs=[],
    )

    created = [call.args[0] for call in db.add.call_args_list if isinstance(call.args[0], Opportunity)]
    assert created == []
    assert result.skipped == 1
    assert result.skip_reasons["strict_missing_application_url"] == 1


def test_strict_official_low_confidence_skip_persists_raw_diagnostics(monkeypatch) -> None:
    db = _make_db()
    source = _make_strict_source()
    page = _make_page()
    page.original_apply_url = "https://jobs.example.com/apply/worker"
    crawl_run = MagicMock(id=103)
    storage = MagicMock()
    storage.put_text.return_value = "/tmp/raw.html"

    monkeypatch.setattr("app.ingestion.pipeline.is_latest_snapshot_duplicate", lambda *args, **kwargs: False)
    monkeypatch.setattr(
        "app.ingestion.pipeline._extract_records_for_page",
        lambda *_args, **_kwargs: [
            JobOpportunityExtraction(
                title="General Worker",
                summary="Worker role in Saudi Arabia.",
                country="Saudi Arabia",
                employer="Tamimi",
                application_url="https://jobs.example.com/apply/worker",
                requirements=["Basic fitness required"],
                extraction_confidence=0.42,
                field_confidences={"application_url": 1.0, "deadline_text": 0.0},
                evidence_snippets=["Apply now", "General worker role"],
            )
        ],
    )

    result = PipelineResult()
    _process_page(
        db=db,
        page=page,
        source=source,
        crawl_run=crawl_run,
        storage=storage,
        parser=lambda current_page: {"title": current_page.title},
        trust_badge="à¦…à¦«à¦¿à¦¸à¦¿à§Ÿà¦¾à¦² à¦ªà¦¾à¦°à§à¦Ÿà¦¨à¦¾à¦°",
        result=result,
        logs=[],
    )

    raws = [call.args[0] for call in db.add.call_args_list if isinstance(call.args[0], RawDocument)]
    assert len(raws) == 1
    assert raws[0].skip_reason == "strict_low_ai_confidence"
    attempts = raws[0].extraction_diagnostics_json["attempts"]
    assert len(attempts) == 1
    assert attempts[0]["extraction_confidence"] == 0.42
    assert attempts[0]["skip_reason"] == "strict_low_ai_confidence"
    assert attempts[0]["field_confidences"]["application_url"] == 1.0
    assert result.skipped_confidences == [0.42]


def test_strict_official_job_is_auto_published(monkeypatch) -> None:
    db = _make_db()
    source = _make_strict_source()
    page = _make_page()
    page.original_apply_url = "https://tamimi.sa/job/cleaner-worker"
    crawl_run = MagicMock(id=102)
    storage = MagicMock()
    storage.put_text.return_value = "/tmp/raw.html"

    monkeypatch.setattr("app.ingestion.pipeline.is_latest_snapshot_duplicate", lambda *args, **kwargs: False)
    monkeypatch.setattr(
        "app.ingestion.pipeline._extract_records_for_page",
        lambda *_args, **_kwargs: [
            JobOpportunityExtraction(
                title="Cleaner worker",
                summary="Cleaner worker role in Saudi Arabia.",
                summary_en="Cleaner worker role in Saudi Arabia.",
                country="Saudi Arabia",
                employer="Tamimi",
                application_url="https://tamimi.sa/job/cleaner-worker",
                requirements=["Basic fitness required", "No prior experience needed"],
                extraction_confidence=0.86,
            )
        ],
    )
    monkeypatch.setattr("app.ingestion.pipeline._enrich_official_bilingual_fields", lambda *_args, **_kwargs: None)
    monkeypatch.setattr("app.ingestion.pipeline.find_existing_opportunity", lambda *args, **kwargs: None)

    result = PipelineResult()
    _process_page(
        db=db,
        page=page,
        source=source,
        crawl_run=crawl_run,
        storage=storage,
        parser=lambda current_page: {"title": current_page.title},
        trust_badge="অফিসিয়াল পার্টনার",
        result=result,
        logs=[],
    )

    created = [call.args[0] for call in db.add.call_args_list if isinstance(call.args[0], Opportunity)]
    assert len(created) == 1
    assert created[0].status == "published"
    assert created[0].review_status == "approved"
    assert created[0].needs_admin_review is False
    assert result.published == 1
