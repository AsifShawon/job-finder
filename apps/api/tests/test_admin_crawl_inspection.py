from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.api.v1.endpoints import admin_crawl_inspection


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
    db = MagicMock()
    db.scalar.side_effect = [run, source]
    db.scalars.return_value.all.return_value = [raw]

    inspection = admin_crawl_inspection.crawl_run_inspection(run_id=12, db=db, _=MagicMock())

    assert inspection.run_id == 12
    assert inspection.pages_discovered == 4
    assert inspection.detail_pages_followed == 1
    assert inspection.parser_success_count == 1
    assert inspection.ai_success_count == 1
    assert inspection.pending_admin_review_count == 1
    assert inspection.pages[0].parser_status == "parser_pending_admin"
    assert inspection.pages[0].ai_status == "ai_completed_pending_publish"
    assert inspection.pages[0].publish_status == "ai_completed_pending_publish"


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
