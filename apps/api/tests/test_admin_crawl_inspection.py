from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

from fastapi import HTTPException

from app.api.v1.endpoints import admin_crawl_inspection
from app.schemas.admin import RawDocumentBatchRequest, SaveAiEditsRequest


def _raw_document(**overrides):
    diagnostics = {
        "crawl": {
            "requested_url": "https://jobs.alfanar.com/alfanar/go/All-Openings/4442101/",
            "listing_page_url": "https://jobs.alfanar.com/alfanar/go/All-Openings/4442101/",
            "final_url": "https://jobs.alfanar.com/alfanar/job/Riyadh-Site-Electrical/123",
            "crawl_engine": "playwright",
            "raw_html_length": 1234,
            "raw_text_length": 456,
        },
        "section_parser": {
            "status": "success",
            "state": "parser_pending_admin",
            "parser_confidence": 0.88,
            "parsed_payload": {
                "source_url": "https://jobs.alfanar.com/alfanar/go/All-Openings/4442101/",
                "final_url": "https://jobs.alfanar.com/alfanar/job/Riyadh-Site-Electrical/123",
                "connector_key": "successfactors_alfanar",
                "company": "alfanar",
                "title": "ENGINEER, SITE ELECTRICAL",
                "country": "Saudi Arabia",
                "city": "Riyadh",
                "department": "Electrical",
                "posted_date_text": None,
                "apply_url": "https://jobs.alfanar.com/apply/123",
                "job_purpose": "Manage site electrical works.",
                "responsibilities": ["Supervise electrical installations on site"],
                "key_accountabilities": [],
                "role_accountabilities": [],
                "qualifications": ["Bachelor Degree in Electrical Engineering"],
                "technical_skills": ["Experience with AutoCAD"],
                "competencies": [],
                "work_experience": "4 to 6 years of work experience",
                "education": "Bachelor Degree in Electrical Engineering",
                "work_permit_or_iqama": None,
                "salary_text": None,
                "deadline_text": None,
                "benefits": [],
                "raw_sections": [{"heading": "Job Purpose", "normalized_heading": "job_purpose", "items": ["Manage site electrical works."], "raw_text": "Manage site electrical works.", "confidence": 0.8}],
                "ignored_noise_lines": ["Apply Now"],
                "parser_warnings": [],
                "parser_confidence": 0.88,
                "field_sources": {},
                "requisition_id": "123",
            },
            "ignored_noise_lines": ["Apply Now"],
            "warnings": [],
        },
        "ai": {
            "status": "ai_completed_pending_publish",
            "provider": "mistral",
            "model": "mistral-small",
            "prompt_version": "official_job_compact_v1",
            "input_payload": {"title": "ENGINEER, SITE ELECTRICAL"},
            "raw_output": {"title": "ENGINEER, SITE ELECTRICAL"},
            "validated_output": {
                "record_type": "job",
                "title": "ENGINEER, SITE ELECTRICAL",
                "summary_en": "alfanar is hiring an Engineer, Site Electrical in Riyadh, Saudi Arabia.",
                "summary_bn": "alfanar Riyadh এ Engineer, Site Electrical পদে নিয়োগ দিচ্ছে।",
                "application_url": "https://jobs.alfanar.com/apply/123",
                "requirements": ["Bachelor Degree in Electrical Engineering"],
                "responsibilities": ["Supervise electrical installations on site"],
                "source_sections": [{"title": "Job Purpose", "items": ["Manage site electrical works."]}],
            },
            "validation_errors": [],
            "repair_attempted": False,
            "repair_success": False,
        },
        "final_record": {
            "opportunity_id": 501,
            "status": "ai_completed_pending_publish",
            "published": False,
            "fallback_used": False,
        },
        "attempts": [],
    }
    values = {
        "id": 91,
        "crawl_run_id": 12,
        "source_id": 4,
        "source_url": "https://jobs.alfanar.com/alfanar/job/Riyadh-Site-Electrical/123",
        "canonical_url": "https://jobs.alfanar.com/alfanar/job/Riyadh-Site-Electrical/123",
        "raw_title": "ENGINEER, SITE ELECTRICAL",
        "raw_text": "Job Purpose\nManage site electrical works.",
        "raw_html_snapshot": "<html></html>",
        "metadata_json": {
            "connector_key": "successfactors_alfanar",
            "company": "alfanar",
            "listing_page_url": "https://jobs.alfanar.com/alfanar/go/All-Openings/4442101/",
            "final_rendered_url": "https://jobs.alfanar.com/alfanar/job/Riyadh-Site-Electrical/123",
        },
        "skip_reason": None,
        "content_type": "html",
        "extraction_diagnostics_json": diagnostics,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_crawl_run_inspection_returns_all_pipeline_stages() -> None:
    run = SimpleNamespace(
        id=12,
        source_id=4,
        connector_key="successfactors_alfanar",
        status="running",
        discovered_count=4,
        parsed_count=4,
        draft_created_count=0,
        draft_updated_count=0,
        duplicate_count=0,
        skipped_count=0,
        failed_count=0,
        manual_review_count=4,
        started_at=datetime(2026, 5, 18, 9, 0, tzinfo=UTC),
        finished_at=None,
        logs={
            "messages": ["Discovered 4 detail pages"],
            "diagnostics": {
                "extraction_method_counts": {"official_parser_only": 4},
                "skip_reasons": {},
                "manual_review_count": 4,
            },
        },
    )
    source = SimpleNamespace(id=4, name="alfanar Careers", base_url="https://jobs.alfanar.com/alfanar/go/All-Openings/4442101/")
    raw = _raw_document()
    opportunity = SimpleNamespace(
        id=501,
        raw_document_id=raw.id,
        needs_admin_review=True,
        status="pending",
        review_status="needs_manual_fix",
    )
    db = MagicMock()
    db.scalar.side_effect = [source]
    db.scalars.side_effect = [
        SimpleNamespace(all=lambda: [raw]),
        SimpleNamespace(all=lambda: [opportunity]),
    ]

    original_get_run = admin_crawl_inspection._get_run
    admin_crawl_inspection._get_run = lambda _db, _run_id: run

    try:
        inspection = admin_crawl_inspection.crawl_run_inspection(run_id=12, db=db, _=MagicMock())
    finally:
        admin_crawl_inspection._get_run = original_get_run

    assert inspection.run_id == 12
    assert inspection.pages_discovered == 4
    assert inspection.detail_pages_followed == 1
    assert inspection.parser_success_count == 1
    assert inspection.ai_success_count == 1
    assert inspection.pending_admin_review_count == 1
    assert inspection.ready_to_publish_count == 1
    assert inspection.needs_review_count == 1
    assert inspection.next_action_key == "publish_ready_jobs"
    assert inspection.pages[0].parser_status == "parser_pending_admin"
    assert inspection.pages[0].ai_status == "ai_completed_pending_publish"
    assert inspection.pages[0].publish_status == "ai_completed_pending_publish"
    assert inspection.pages[0].stage == "ready_to_publish"
    assert inspection.pages[0].status_label == "Needs review"


def test_raw_document_inspection_exposes_parser_ai_and_final_record(monkeypatch) -> None:
    raw = _raw_document()
    source = SimpleNamespace(id=4, name="alfanar Careers", connector_key="successfactors_alfanar")
    monkeypatch.setattr(admin_crawl_inspection, "_get_raw_document", lambda db, raw_document_id: (raw, source))

    inspection = admin_crawl_inspection.raw_document_inspection(
        raw_document_id=raw.id,
        db=MagicMock(),
        _=MagicMock(),
    )

    assert inspection.raw_document_id == raw.id
    assert inspection.section_parser["status"] == "success"
    assert inspection.compact_ai_input == {"title": "ENGINEER, SITE ELECTRICAL"}
    assert inspection.validated_ai_output["title"] == "ENGINEER, SITE ELECTRICAL"
    assert inspection.final_record["opportunity_id"] == 501


def test_parse_sections_rebuilds_parser_and_ai_input(monkeypatch) -> None:
    raw = _raw_document(
        id=77,
        source_url="https://tamimi.sa/job/scaffolding-erectors",
        canonical_url="https://tamimi.sa/job/scaffolding-erectors",
        raw_title="Scaffolding Erectors",
        raw_text="\n".join(
            [
                "Scaffolding Erectors",
                "Start apply with LinkedIn",
                "Apply Now",
                "Transferable iqama required",
                "Department",
                "Projects Department",
                "Location",
                "Jubail, Saudi Arabia",
                "Job Description",
                "Assemble and dismantle scaffolding structures",
            ]
        ),
        raw_html_snapshot="""
        <html>
          <body>
            <h1>Scaffolding Erectors</h1>
            <h2>Department</h2><p>Projects Department</p>
            <h2>Location</h2><p>Jubail, Saudi Arabia</p>
            <h2>Transferable iqama</h2><p>Transferable iqama required</p>
            <h2>Job Description</h2><p>Assemble and dismantle scaffolding structures</p>
          </body>
        </html>
        """,
        metadata_json={"connector_key": "tamimi_careers", "company": "Tamimi"},
        extraction_diagnostics_json={},
    )
    source = SimpleNamespace(id=9, name="Tamimi Careers", connector_key="tamimi_careers")
    db = MagicMock()
    monkeypatch.setattr(admin_crawl_inspection, "_get_raw_document", lambda _db, raw_document_id: (raw, source))

    result = admin_crawl_inspection.parse_sections(
        raw_document_id=raw.id,
        db=db,
        _=MagicMock(),
    )

    assert result.raw_document_id == raw.id
    assert result.status in {"parser_pending_admin", "parser_low_confidence"}
    assert raw.extraction_diagnostics_json["section_parser"]["parsed_payload"]["title"] == "Scaffolding Erectors"
    assert raw.extraction_diagnostics_json["section_parser"]["parsed_payload"]["work_permit_or_iqama"] == "Transferable iqama required"
    assert raw.extraction_diagnostics_json["ai"]["input_payload"]["title"] == "Scaffolding Erectors"
    db.commit.assert_called_once()


def test_batch_parse_sections_processes_multiple_raw_documents(monkeypatch) -> None:
    run = SimpleNamespace(id=12)
    raw_one = _raw_document(id=1, raw_title="One")
    raw_two = _raw_document(id=2, raw_title="Two")
    db = MagicMock()
    db.scalars.return_value.all.return_value = [raw_one, raw_two]
    monkeypatch.setattr(admin_crawl_inspection, "_get_run", lambda _db, _run_id: run)
    monkeypatch.setattr(
        admin_crawl_inspection,
        "parse_one_raw_document",
        lambda _db, raw_document_id: admin_crawl_inspection.RawDocumentActionResult(
            raw_document_id=raw_document_id,
            status="parser_pending_admin",
            message="Parsed successfully",
            opportunity_id=None,
            diagnostics={},
        ),
    )

    result = admin_crawl_inspection.batch_parse_sections(
        run_id=12,
        payload=RawDocumentBatchRequest(raw_document_ids=[1, 2]),
        db=db,
        _=MagicMock(),
    )

    assert result.total == 2
    assert result.processed == 2
    assert result.skipped == 0
    assert result.failed == 0
    assert [item.after_status for item in result.results] == ["parser_pending_admin", "parser_pending_admin"]
    assert db.commit.call_count == 2


def test_batch_run_ai_skips_unparsed_documents(monkeypatch) -> None:
    run = SimpleNamespace(id=12)
    raw_one = _raw_document(id=1, raw_title="Needs Parse", extraction_diagnostics_json={})
    raw_two = _raw_document(id=2, raw_title="Ready")
    db = MagicMock()
    db.scalars.return_value.all.return_value = [raw_one, raw_two]
    monkeypatch.setattr(admin_crawl_inspection, "_get_run", lambda _db, _run_id: run)

    def fake_run_ai(_db, raw_document_id: int):
        if raw_document_id == 1:
            raise HTTPException(status_code=409, detail="Parsed section payload not found")
        return admin_crawl_inspection.RawDocumentActionResult(
            raw_document_id=raw_document_id,
            status="ai_completed_pending_publish",
            message="AI extraction completed",
            opportunity_id=None,
            diagnostics={},
        )

    monkeypatch.setattr(admin_crawl_inspection, "run_ai_for_one_raw_document", fake_run_ai)

    result = admin_crawl_inspection.batch_run_ai(
        run_id=12,
        payload=RawDocumentBatchRequest(raw_document_ids=[1, 2]),
        db=db,
        _=MagicMock(),
    )

    assert result.processed == 1
    assert result.skipped == 1
    assert result.failed == 0
    assert result.results[0].message == "Parsed section payload not found"
    assert result.results[1].after_status == "ai_completed_pending_publish"


def test_batch_publish_only_publishes_ready_jobs(monkeypatch) -> None:
    run = SimpleNamespace(id=12)
    raw_one = _raw_document(id=1, raw_title="Ready")
    raw_two = _raw_document(id=2, raw_title="Blocked")
    db = MagicMock()
    db.scalars.return_value.all.return_value = [raw_one, raw_two]
    monkeypatch.setattr(admin_crawl_inspection, "_get_run", lambda _db, _run_id: run)

    def fake_publish(_db, raw_document_id: int, _admin_id: int):
        if raw_document_id == 2:
            raise HTTPException(status_code=409, detail="This job is not ready to publish")
        return admin_crawl_inspection.RawDocumentActionResult(
            raw_document_id=raw_document_id,
            status="published",
            message="Opportunity published",
            opportunity_id=raw_document_id + 500,
            diagnostics={},
        )

    monkeypatch.setattr(admin_crawl_inspection, "publish_one_raw_document", fake_publish)

    result = admin_crawl_inspection.batch_publish(
        run_id=12,
        payload=RawDocumentBatchRequest(raw_document_ids=[1, 2]),
        db=db,
        admin=SimpleNamespace(id=77),
    )

    assert result.processed == 1
    assert result.skipped == 1
    assert result.failed == 0
    assert result.results[0].after_status == "published"
    assert result.results[1].message == "This job is not ready to publish"


def test_failed_item_does_not_stop_batch(monkeypatch) -> None:
    run = SimpleNamespace(id=12)
    raw_one = _raw_document(id=1, raw_title="Broken")
    raw_two = _raw_document(id=2, raw_title="Still Works")
    db = MagicMock()
    db.scalars.return_value.all.return_value = [raw_one, raw_two]
    monkeypatch.setattr(admin_crawl_inspection, "_get_run", lambda _db, _run_id: run)

    def fake_parse(_db, raw_document_id: int):
        if raw_document_id == 1:
            raise RuntimeError("boom")
        return admin_crawl_inspection.RawDocumentActionResult(
            raw_document_id=raw_document_id,
            status="parser_pending_admin",
            message="Section parser completed",
            opportunity_id=None,
            diagnostics={},
        )

    monkeypatch.setattr(admin_crawl_inspection, "parse_one_raw_document", fake_parse)

    result = admin_crawl_inspection.batch_parse_sections(
        run_id=12,
        payload=RawDocumentBatchRequest(raw_document_ids=[1, 2]),
        db=db,
        _=MagicMock(),
    )

    assert result.processed == 1
    assert result.failed == 1
    assert result.skipped == 0
    assert result.results[0].message == "boom"
    assert result.results[1].after_status == "parser_pending_admin"
    db.rollback.assert_called_once()


def test_mark_review_creates_pending_review_draft(monkeypatch) -> None:
    raw = _raw_document(id=25, final_record={})
    source = SimpleNamespace(id=4, name="alfanar Careers", connector_key="successfactors_alfanar", trust_level="official_partner", country="Saudi Arabia")
    review_draft = SimpleNamespace(
        id=701,
        review_status="pending",
        admin_status="needs_review",
        needs_admin_review=False,
        status="pending",
        is_active=False,
        reviewed_by=None,
        reviewed_at=None,
    )
    db = MagicMock()
    monkeypatch.setattr(admin_crawl_inspection, "_get_raw_document", lambda _db, _raw_document_id: (raw, source))
    monkeypatch.setattr(admin_crawl_inspection, "_upsert_official_opportunity", lambda *_args, **_kwargs: review_draft)

    result = admin_crawl_inspection.mark_one_raw_document_for_review(db, raw.id, admin_id=9)

    assert result.status == "needs_review"
    assert result.opportunity_id == 701
    assert review_draft.review_status == "needs_manual_fix"
    assert raw.extraction_diagnostics_json["final_record"]["opportunity_id"] == 701


def test_save_ai_edits_updates_validated_output(monkeypatch) -> None:
    raw = _raw_document()
    source = SimpleNamespace(id=4, name="alfanar Careers", connector_key="successfactors_alfanar", trust_level="official_partner", country="Saudi Arabia")
    synced_draft = SimpleNamespace(
        id=501,
        admin_status="needs_review",
        review_status="pending",
        needs_admin_review=True,
    )
    db = MagicMock()
    monkeypatch.setattr(admin_crawl_inspection, "_get_raw_document", lambda _db, _raw_document_id: (raw, source))
    monkeypatch.setattr(admin_crawl_inspection, "_get_existing_opportunity", lambda _db, _raw: None)
    monkeypatch.setattr(admin_crawl_inspection, "_upsert_official_opportunity", lambda *_args, **_kwargs: synced_draft)

    result = admin_crawl_inspection.save_ai_edits(
        raw_document_id=raw.id,
        payload=SaveAiEditsRequest(
            validated_output={
                "summary_en": "Updated English summary",
                "summary_bn": "আপডেট বাংলা সারসংক্ষেপ",
                "requirements": ["Bachelor Degree in Electrical Engineering", "Valid passport"],
                "responsibilities": ["Supervise electrical installations on site", "Maintain safety checks"],
                "journey_steps": ["Review job details", "Apply online"],
                "documents_needed": ["Passport", "CV"],
            }
        ),
        db=db,
        _=MagicMock(),
    )

    assert result.status == "ai_completed_pending_publish"
    assert result.opportunity_id == 501
    assert raw.extraction_diagnostics_json["ai"]["validated_output"]["summary_en"] == "Updated English summary"
    assert raw.extraction_diagnostics_json["final_record"]["opportunity_id"] == 501
    db.commit.assert_called_once()
