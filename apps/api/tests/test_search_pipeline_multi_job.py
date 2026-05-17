from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from app.ingestion.extractor import extract_structured
from app.ingestion.pipeline import (
    PipelineResult,
    _build_requirements_json,
    _extract_records_for_page,
    _official_ai_cleaned_payload,
    _process_page,
)
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
        "low_confidence_to_review": True,
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

    monkeypatch.setattr("app.ingestion.pipeline.extract_official_job_structured", fake_extract_structured)
    monkeypatch.setattr("app.ingestion.pipeline._structured_page_extraction", fail_structured)

    records = _extract_records_for_page(db, source, page, {"title": page.title, "body_text": page.raw_text})

    assert called["ai"] is True
    assert called["structured"] is False
    assert len(records) == 1
    assert records[0].application_url == "https://tamimi.sa/job/electrical-supervisor"


def test_official_payload_preserves_job_sections_and_removes_boilerplate() -> None:
    source = _make_strict_source()
    page = FetchedPage(
        url="https://jobs.alfanar.com/alfanar/job/123",
        title="Engineer, Design Electrical",
        raw_html="""
        <html><body>
          <nav>Careers Home My Profile</nav>
          <main class="jobDisplay">
            <h1>ENGINEER, DESIGN ELECTRICAL</h1>
            <p>By continuing to use and navigate this website, you are agreeing to cookies.</p>
            <h2>Job Purpose</h2>
            <p>To lead and manage the design and development of electrical systems.</p>
            <h2>Key Accountability Areas</h2>
            <ul><li>Design electrical systems and components using AutoCAD.</li></ul>
          </main>
        </body></html>
        """,
        raw_text="fallback text",
        original_apply_url="https://jobs.alfanar.com/apply",
        metadata={"structured_job": True, "company": "alfanar", "location_raw": "Saudi Arabia"},
    )

    payload = _official_ai_cleaned_payload(source, page, {"title": page.title, "body_text": ""})
    body = payload["body_text"]

    assert "Job Purpose" in body
    assert "Key Accountability Areas" in body
    assert "Design electrical systems and components using AutoCAD" in body
    assert "By continuing to use and navigate this website" not in body
    assert "My Profile" not in body


def test_rich_official_requirements_json_preserves_grouped_sections() -> None:
    extraction = JobOpportunityExtraction(
        title="Engineer",
        requirements=["Bachelor degree required"],
        qualifications=["Five years of design experience"],
        key_accountabilities=["Design electrical systems"],
        role_accountabilities=["Create technical drawings"],
        skills=["AutoCAD", "REVIT"],
        job_purpose="Lead electrical design work.",
        source_sections=[
            {"title": "Job Purpose", "items": ["Lead electrical design work."]},
            {"title": "Key Accountability Areas", "items": ["Design electrical systems"]},
        ],
    )

    requirements_json = _build_requirements_json(extraction)

    assert requirements_json["items"] == [
        "Bachelor degree required",
        "Five years of design experience",
        "AutoCAD",
        "REVIT",
    ]
    assert requirements_json["groups"]["key_accountabilities"] == ["Design electrical systems"]
    assert requirements_json["source_sections"][0]["title"] == "Job Purpose"


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


def test_strict_official_low_confidence_routes_to_review_and_persists_raw_diagnostics(monkeypatch) -> None:
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
                extraction_method="llm_structured",
                field_confidences={"application_url": 1.0, "deadline_text": 0.0},
                evidence_snippets=["Apply now", "General worker role"],
            )
        ],
    )
    monkeypatch.setattr("app.ingestion.pipeline.find_existing_opportunity", lambda *args, **kwargs: None)
    monkeypatch.setattr("app.ingestion.pipeline._enrich_official_bilingual_fields", lambda *_args, **_kwargs: None)

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

    created = [call.args[0] for call in db.add.call_args_list if isinstance(call.args[0], Opportunity)]
    raws = [call.args[0] for call in db.add.call_args_list if isinstance(call.args[0], RawDocument)]
    assert len(created) == 1
    assert len(raws) == 1
    assert raws[0].skip_reason is None
    attempts = raws[0].extraction_diagnostics_json["attempts"]
    assert len(attempts) == 1
    assert attempts[0]["extraction_confidence"] == 0.42
    assert attempts[0]["review_reason"] == "low_confidence_official_job"
    assert attempts[0]["extraction_method"] == "llm_structured"
    assert attempts[0]["field_confidences"]["application_url"] == 1.0
    assert created[0].status == "pending"
    assert created[0].review_status == "pending"
    assert created[0].needs_admin_review is True
    assert created[0].admin_status == "low_confidence_official_job"
    assert result.skipped_confidences == []
    assert result.skipped == 0
    assert result.low_confidence_review_count == 1


def test_extract_structured_without_ai_key_uses_fallback_method(monkeypatch) -> None:
    db = MagicMock()
    monkeypatch.setattr("app.ingestion.extractor.get_ai_provider", lambda *_args, **_kwargs: "mistral")
    monkeypatch.setattr("app.ingestion.extractor.get_ai_api_key", lambda *_args, **_kwargs: None)

    extraction = extract_structured(db, {"title": "Worker", "body_text": "Apply now. Employer. Country. Requirements."})

    assert extraction.extraction_method == "fallback_extract"
    assert extraction.fallback_reason == "no_ai_api_key"
    assert extraction.extraction_confidence == 0.45


def test_extract_structured_success_marks_llm_method(monkeypatch) -> None:
    db = MagicMock()
    monkeypatch.setattr("app.ingestion.extractor.get_ai_provider", lambda *_args, **_kwargs: "mistral")
    monkeypatch.setattr("app.ingestion.extractor.get_ai_api_key", lambda *_args, **_kwargs: "secret")
    monkeypatch.setattr(
        "app.ingestion.extractor._invoke_for_extraction",
        lambda *_args, **_kwargs: SimpleNamespace(
            data=JobOpportunityExtraction(
                title="Site Engineer",
                summary="Engineering role in Saudi Arabia.",
                summary_en="Engineering role in Saudi Arabia.",
                country="Saudi Arabia",
                employer="alfanar",
                application_url="https://jobs.example.com/apply/1",
                requirements=["Relevant diploma required"],
                extraction_confidence=0.72,
            )
        ),
    )
    monkeypatch.setattr("app.ingestion.extractor._self_correct", lambda *_args, **_kwargs: {})

    extraction = extract_structured(db, {"title": "Site Engineer", "body_text": "Engineering role. Apply online."})

    assert extraction.extraction_method == "llm_structured"
    assert extraction.fallback_reason is None
    assert extraction.extraction_confidence >= 0.72


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
