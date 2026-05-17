from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user, get_db
from app.ingestion.eligibility_engine import tag_eligibility
from app.ingestion.extractor import (
    build_official_job_ai_input_payload,
    official_parsed_payload_to_fallback_extraction,
    run_official_job_ai_extraction,
)
from app.ingestion.official_job_detail_parser import parse_official_job_detail
from app.ingestion.official_job_sections import OfficialJobParsedPayload
from app.ingestion.pipeline import (
    _build_benefits_json,
    _build_requirements_json,
    _extract_visa_info,
    _format_salary_text,
    _list_to_text,
)
from app.ingestion.validators import parse_deadline
from app.models.entities import CrawlRun, Opportunity, RawDocument, Source, User
from app.schemas.admin import (
    CrawlInspectionPageSummary,
    CrawlRunInspectionOut,
    RawDocumentActionResult,
    RawDocumentInspectionOut,
    SaveParserEditsRequest,
)
from app.services.isc_taxonomy import determine_isc_category_key

router = APIRouter(prefix="/admin", tags=["admin"])


def _diagnostics(raw: RawDocument) -> dict[str, Any]:
    return dict(raw.extraction_diagnostics_json or {}) if isinstance(raw.extraction_diagnostics_json, dict) else {}


def _save_diagnostics(raw: RawDocument, diagnostics: dict[str, Any]) -> None:
    raw.extraction_diagnostics_json = diagnostics


def _parsed_payload(raw: RawDocument) -> OfficialJobParsedPayload:
    parsed = ((_diagnostics(raw).get("section_parser") or {}).get("parsed_payload") or {})
    if not parsed:
        raise HTTPException(status_code=409, detail="Parsed section payload not found")
    return OfficialJobParsedPayload.model_validate(parsed)


def _append_attempt(raw: RawDocument, extraction, *, review_reason: str | None = None) -> None:
    diagnostics = _diagnostics(raw)
    attempts = list(diagnostics.get("attempts") or [])
    attempts.append(
        {
            "record_type": extraction.record_type,
            "extraction_confidence": float(extraction.extraction_confidence or 0.0),
            "field_confidences": dict(extraction.field_confidences or {}),
            "evidence_snippets": list(extraction.evidence_snippets or []),
            "application_url": extraction.application_url,
            "employer": extraction.employer or extraction.organization,
            "country": extraction.country,
            "title": extraction.title,
            "summary": extraction.summary,
            "extraction_method": extraction.extraction_method,
            "fallback_reason": extraction.fallback_reason,
            "validation_errors": [],
            "skip_reason": None,
            "review_reason": review_reason,
        }
    )
    diagnostics["attempts"] = attempts
    _save_diagnostics(raw, diagnostics)


def _build_inspection(raw: RawDocument, source: Source | None) -> RawDocumentInspectionOut:
    diagnostics = _diagnostics(raw)
    crawl = diagnostics.get("crawl") or {}
    parser_diag = diagnostics.get("section_parser") or {}
    ai_diag = diagnostics.get("ai") or {}
    final_record = diagnostics.get("final_record") or {}
    warnings = list(parser_diag.get("warnings") or [])
    warnings.extend(ai_diag.get("validation_errors") or [])
    if raw.skip_reason and raw.skip_reason not in warnings:
        warnings.append(raw.skip_reason)
    return RawDocumentInspectionOut(
        raw_document_id=raw.id,
        crawl_run_id=raw.crawl_run_id,
        source_id=raw.source_id,
        source_name=source.name if source else None,
        connector_key=(raw.metadata_json or {}).get("connector_key") or (source.connector_key if source else None),
        source_url=raw.source_url,
        raw_title=raw.raw_title,
        requested_url=crawl.get("requested_url"),
        listing_page_url=crawl.get("listing_page_url"),
        final_url=crawl.get("final_url") or raw.canonical_url,
        raw_text_preview=(raw.raw_text or "")[:4000] or None,
        cleaned_text=raw.raw_text,
        raw_html_snapshot=raw.raw_html_snapshot,
        metadata_json=raw.metadata_json or {},
        section_parser=parser_diag,
        compact_ai_input=ai_diag.get("input_payload"),
        raw_ai_output=ai_diag.get("raw_output"),
        validated_ai_output=ai_diag.get("validated_output"),
        final_record=final_record,
        final_opportunity_id=final_record.get("opportunity_id"),
        skip_reason=raw.skip_reason,
        fallback_reason=((ai_diag.get("validated_output") or {}).get("fallback_reason") if isinstance(ai_diag.get("validated_output"), dict) else None),
        warnings=warnings,
    )


def _get_raw_document(db: Session, raw_document_id: int) -> tuple[RawDocument, Source]:
    raw = db.scalar(select(RawDocument).where(RawDocument.id == raw_document_id))
    if not raw:
        raise HTTPException(status_code=404, detail="Raw document not found")
    source = db.scalar(select(Source).where(Source.id == raw.source_id))
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return raw, source


def _upsert_official_opportunity(
    db: Session,
    *,
    source: Source,
    raw: RawDocument,
    extraction,
    publish: bool,
    admin_id: int | None = None,
) -> Opportunity:
    opportunity = db.scalar(select(Opportunity).where(Opportunity.raw_document_id == raw.id))
    if opportunity is None:
        opportunity = db.scalar(
            select(Opportunity).where(
                Opportunity.source_id == source.id,
                Opportunity.source_page_url == (raw.canonical_url or raw.source_url),
            )
        )
    if opportunity is None:
        opportunity = Opportunity(
            source_id=source.id,
            source_name=source.name,
            source_page_url=raw.canonical_url or raw.source_url,
            source_url=raw.canonical_url or raw.source_url,
            connector_key=source.connector_key,
            content_type=raw.content_type or "html",
            opportunity_type="overseas_job",
            record_type="job",
            title=extraction.title or raw.raw_title or "Untitled",
            requirements_json={"items": []},
            benefits_json={"items": []},
            language_requirements_json={"items": []},
            journey_steps=[],
            documents_needed=[],
            documents_required=[],
            application_steps=[],
            target_audience_tags=[],
            risk_flags=[],
        )
        db.add(opportunity)

    requirements_json = _build_requirements_json(extraction)
    benefits_json = _build_benefits_json(extraction)
    eligibility = tag_eligibility(
        source_connector_key=source.connector_key,
        source_trust_level=source.trust_level,
        record_type=extraction.record_type,
        country=extraction.country or source.country,
        eligibility_text=extraction.eligibility_text,
        requirements_json=requirements_json,
        extracted_json=extraction.model_dump(mode="json"),
        title=extraction.title,
        summary=extraction.summary or extraction.summary_en,
        employer=extraction.employer,
    )
    now = datetime.now(UTC)
    opportunity.source_id = source.id
    opportunity.source_name = source.name
    opportunity.source_page_url = raw.canonical_url or raw.source_url
    opportunity.source_url = raw.canonical_url or raw.source_url
    opportunity.original_apply_url = extraction.application_url or opportunity.source_page_url
    opportunity.content_type = raw.content_type or "html"
    opportunity.opportunity_type = "overseas_job"
    opportunity.record_type = extraction.record_type
    opportunity.title = extraction.title or raw.raw_title or "Untitled"
    opportunity.title_bn = extraction.title_bn or opportunity.title
    opportunity.title_en = opportunity.title if re.search(r"[A-Za-z]", opportunity.title or "") else opportunity.title_en
    opportunity.summary = extraction.summary or extraction.summary_en
    opportunity.summary_bn = extraction.summary_bn
    opportunity.summary_en = extraction.summary_en or extraction.summary
    opportunity.country = extraction.country or source.country
    opportunity.city = extraction.city
    opportunity.destination_country = extraction.country or source.country
    opportunity.employer_or_organization = extraction.employer or extraction.organization or source.name
    opportunity.employer = extraction.employer or source.name
    opportunity.organization = extraction.organization
    opportunity.sector = extraction.sector or extraction.organization or source.name
    opportunity.job_title = extraction.title
    opportunity.degree_level = extraction.degree_level
    opportunity.education_min = extraction.degree_level
    opportunity.salary_min = extraction.salary_min
    opportunity.salary_max = extraction.salary_max
    opportunity.salary_currency = extraction.salary_currency
    opportunity.salary_text = _format_salary_text(extraction.salary_min, extraction.salary_max, extraction.salary_currency)
    opportunity.location_text = (raw.metadata_json or {}).get("location_raw") or ", ".join([item for item in [extraction.city, extraction.country] if item]) or None
    opportunity.deadline = parse_deadline(extraction.deadline_text)
    opportunity.posted_date = parse_deadline((raw.metadata_json or {}).get("posting_date_text"))
    opportunity.application_url = extraction.application_url or opportunity.source_page_url
    opportunity.eligibility_text = extraction.eligibility_text or _list_to_text(requirements_json.get("items"), separator="\n")
    opportunity.visa_support = extraction.visa_support
    opportunity.can_apply_from_bd = extraction.can_apply_from_bd if extraction.can_apply_from_bd is not None else eligibility.can_apply_from_bd
    opportunity.requires_existing_work_permit = eligibility.requires_existing_work_permit
    opportunity.open_to_international_candidates = eligibility.open_to_international_candidates
    opportunity.open_to_authorized_workers_only = eligibility.open_to_authorized_workers_only
    opportunity.eligibility_status = eligibility.eligibility_status
    opportunity.lmia_status = eligibility.lmia_status
    opportunity.target_audience_tags = eligibility.target_audience_tags
    opportunity.risk_flags = eligibility.risk_flags
    opportunity.source_trust_badge = "অফিসিয়াল পার্টনার" if source.trust_level == "official_partner" else opportunity.source_trust_badge
    opportunity.source_trust_tier = source.trust_level
    opportunity.visa_or_work_permit_info = _extract_visa_info(extraction.eligibility_text, raw.raw_text)
    opportunity.visa_or_iqama_requirement = opportunity.visa_or_work_permit_info
    opportunity.education_requirement = extraction.degree_level or _list_to_text(extraction.qualifications[:2], separator="\n")
    opportunity.experience_requirement = next((item for item in extraction.qualifications if "experience" in item.lower() or "year" in item.lower()), None)
    opportunity.language_requirement = ", ".join(extraction.language_requirements) if extraction.language_requirements else None
    opportunity.application_process = _list_to_text(extraction.journey_steps, separator="\n")
    opportunity.required_documents = _list_to_text(extraction.documents_needed, separator="\n")
    opportunity.journey_steps = list(extraction.journey_steps)
    opportunity.application_steps = list(extraction.journey_steps)
    opportunity.documents_needed = list(extraction.documents_needed)
    opportunity.documents_required = list(extraction.documents_needed)
    opportunity.typical_salary_bdt = extraction.typical_salary_bdt
    opportunity.requirements_json = requirements_json
    opportunity.benefits_json = benefits_json
    opportunity.language_requirements_json = {"items": list(extraction.language_requirements)}
    opportunity.languages_required = list(extraction.language_requirements)
    opportunity.raw_text = (raw.raw_text or "")[:10_000] or None
    opportunity.raw_document_id = raw.id
    opportunity.connector_key = source.connector_key
    opportunity.extracted_json = extraction.model_dump(mode="json")
    opportunity.extraction_confidence = float(extraction.extraction_confidence or 0.0)
    opportunity.ai_confidence = float(extraction.extraction_confidence or 0.0)
    opportunity.extraction_warnings = ["recovered_bad_summary"] if "recovered_bad_summary" in (extraction.evidence_snippets or []) else []
    opportunity.isc_category_key = determine_isc_category_key(
        opportunity.title,
        opportunity.summary,
        opportunity.summary_bn,
        opportunity.summary_en,
        opportunity.sector,
        opportunity.platform_category_bn,
        opportunity.platform_category_en,
        opportunity.occupation_family,
        opportunity.eligibility_text,
    )
    opportunity.needs_admin_review = not publish
    opportunity.review_status = "approved" if publish else "pending"
    opportunity.admin_status = "auto_approved" if publish else "needs_review"
    opportunity.status = "published" if publish else "pending"
    opportunity.is_active = publish
    opportunity.reviewed_by = admin_id if publish else opportunity.reviewed_by
    opportunity.reviewed_at = now if publish else opportunity.reviewed_at
    opportunity.published_at = now if publish else opportunity.published_at
    opportunity.updated_at = now
    opportunity.first_seen_at = opportunity.first_seen_at or now
    opportunity.last_seen_at = now
    opportunity.missing_count = 0
    opportunity.trust_score = 0.9 if source.trust_level == "official_partner" else 0.75
    opportunity.actionability_score = 0.3 + (0.25 if opportunity.application_url else 0.0) + (0.15 if extraction.requirements else 0.0)
    opportunity.overall_rank_score = round((opportunity.trust_score * 0.6) + (opportunity.actionability_score * 0.4), 3)
    db.flush()
    if publish and not opportunity.slug:
        from app.api.v1.endpoints.admin import _slugify  # avoid circular top-level import

        opportunity.slug = f"{_slugify(opportunity.title or 'opportunity')}-{opportunity.id}"
    return opportunity


@router.get("/crawl-runs/{run_id}/inspection", response_model=CrawlRunInspectionOut)
def crawl_run_inspection(
    run_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> CrawlRunInspectionOut:
    run = db.scalar(select(CrawlRun).where(CrawlRun.id == run_id))
    if not run:
        raise HTTPException(status_code=404, detail="Crawl run not found")
    source = db.scalar(select(Source).where(Source.id == run.source_id))
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    raws = db.scalars(
        select(RawDocument).where(RawDocument.crawl_run_id == run.id).order_by(RawDocument.id.desc())
    ).all()
    parser_success = 0
    ai_success = 0
    pending = 0
    failed = 0
    fallback_reasons: dict[str, int] = {}
    opportunity_ids: list[int] = []
    pages: list[CrawlInspectionPageSummary] = []
    for raw in raws:
        diagnostics = _diagnostics(raw)
        parser_diag = diagnostics.get("section_parser") or {}
        ai_diag = diagnostics.get("ai") or {}
        final_record = diagnostics.get("final_record") or {}
        parser_state = parser_diag.get("state") or parser_diag.get("status")
        ai_state = ai_diag.get("status")
        if parser_diag.get("status") == "success":
            parser_success += 1
        if ai_diag.get("validated_output"):
            ai_success += 1
        if parser_state in {"parser_pending_admin", "parser_low_confidence"} or ai_state in {"ai_pending_admin", "ai_completed_pending_publish", "fallback_ready_pending_publish"}:
            pending += 1
        if raw.skip_reason:
            failed += 1
        validated = ai_diag.get("validated_output") or {}
        fallback_reason = validated.get("fallback_reason") if isinstance(validated, dict) else None
        if fallback_reason:
            fallback_reasons[fallback_reason] = fallback_reasons.get(fallback_reason, 0) + 1
        opportunity_id = final_record.get("opportunity_id")
        if opportunity_id:
            opportunity_ids.append(int(opportunity_id))
        pages.append(
            CrawlInspectionPageSummary(
                raw_document_id=raw.id,
                opportunity_id=opportunity_id,
                title=raw.raw_title,
                source_url=raw.source_url,
                final_url=(diagnostics.get("crawl") or {}).get("final_url") or raw.canonical_url,
                raw_text_length=len(raw.raw_text or ""),
                html_captured=bool(raw.raw_html_snapshot),
                parser_status=parser_state,
                ai_status=ai_state,
                publish_status=final_record.get("status"),
                parser_confidence=float(parser_diag.get("parser_confidence") or 0.0),
                warnings=list(parser_diag.get("warnings") or []),
            )
        )
    run_logs = []
    if isinstance(run.logs, dict):
        run_logs = list(run.logs.get("messages") or [])
    discovery_diagnostics = {}
    extraction_method_counts = {}
    skip_reasons = {}
    if isinstance(run.logs, dict):
        discovery_diagnostics = {k: v for k, v in (run.logs.get("diagnostics") or {}).items() if k not in {"extraction_method_counts", "skip_reasons"}}
        extraction_method_counts = dict((run.logs.get("diagnostics") or {}).get("extraction_method_counts") or {})
        skip_reasons = dict((run.logs.get("diagnostics") or {}).get("skip_reasons") or {})
    return CrawlRunInspectionOut(
        run_id=run.id,
        source_id=source.id,
        source_name=source.name,
        connector_key=run.connector_key,
        crawl_status=str(run.status.value if hasattr(run.status, "value") else run.status),
        source_url=source.base_url,
        started_at=run.started_at,
        finished_at=run.finished_at,
        pages_discovered=run.discovered_count,
        detail_pages_followed=len(raws),
        parser_success_count=parser_success,
        ai_success_count=ai_success,
        failed_count=failed,
        pending_admin_review_count=pending,
        run_logs=run_logs,
        discovery_diagnostics=discovery_diagnostics,
        extraction_method_counts=extraction_method_counts,
        skip_reasons=skip_reasons,
        fallback_reasons=fallback_reasons,
        pages=pages,
        opportunity_ids=opportunity_ids,
    )


@router.get("/raw-documents/{raw_document_id}/inspection", response_model=RawDocumentInspectionOut)
def raw_document_inspection(
    raw_document_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> RawDocumentInspectionOut:
    raw, source = _get_raw_document(db, raw_document_id)
    return _build_inspection(raw, source)


@router.post("/raw-documents/{raw_document_id}/parse-sections", response_model=RawDocumentActionResult)
def parse_sections(
    raw_document_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> RawDocumentActionResult:
    raw, source = _get_raw_document(db, raw_document_id)
    parsed_payload = parse_official_job_detail(
        raw.raw_html_snapshot or "",
        raw.raw_text or "",
        raw.metadata_json or {},
        (raw.metadata_json or {}).get("connector_key") or source.connector_key or "",
        raw.canonical_url or raw.source_url,
    )
    diagnostics = _diagnostics(raw)
    diagnostics["section_parser"] = {
        "status": "success",
        "state": "parser_low_confidence" if parsed_payload.parser_confidence < 0.65 else "parser_pending_admin",
        "parser_confidence": float(parsed_payload.parser_confidence),
        "parsed_payload": parsed_payload.model_dump(mode="json"),
        "ignored_noise_lines": list(parsed_payload.ignored_noise_lines),
        "warnings": list(parsed_payload.parser_warnings),
    }
    diagnostics["ai"] = {
        **(diagnostics.get("ai") or {}),
        "status": "ai_pending_admin",
        "input_payload": build_official_job_ai_input_payload(parsed_payload),
        "raw_output": None,
        "validated_output": None,
        "validation_errors": [],
        "repair_attempted": False,
        "repair_success": False,
    }
    diagnostics["final_record"] = {
        **(diagnostics.get("final_record") or {}),
        "status": diagnostics["section_parser"]["state"],
        "published": False,
        "fallback_used": False,
    }
    _save_diagnostics(raw, diagnostics)
    db.commit()
    return RawDocumentActionResult(
        raw_document_id=raw.id,
        status=str(diagnostics["section_parser"]["state"]),
        message="Section parser completed",
        diagnostics=diagnostics,
    )


@router.post("/raw-documents/{raw_document_id}/save-parser-edits", response_model=RawDocumentActionResult)
def save_parser_edits(
    raw_document_id: int,
    payload: SaveParserEditsRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> RawDocumentActionResult:
    raw, _source = _get_raw_document(db, raw_document_id)
    parsed_payload = OfficialJobParsedPayload.model_validate(payload.parsed_payload)
    diagnostics = _diagnostics(raw)
    diagnostics["section_parser"] = {
        "status": "success",
        "state": "parser_pending_admin",
        "parser_confidence": float(parsed_payload.parser_confidence),
        "parsed_payload": parsed_payload.model_dump(mode="json"),
        "ignored_noise_lines": list(parsed_payload.ignored_noise_lines),
        "warnings": list(parsed_payload.parser_warnings),
    }
    diagnostics["ai"] = {
        **(diagnostics.get("ai") or {}),
        "status": "ai_pending_admin",
        "input_payload": build_official_job_ai_input_payload(parsed_payload),
        "raw_output": None,
        "validated_output": None,
        "validation_errors": [],
        "repair_attempted": False,
        "repair_success": False,
    }
    diagnostics["final_record"] = {
        **(diagnostics.get("final_record") or {}),
        "status": "parser_pending_admin",
        "published": False,
        "fallback_used": False,
    }
    _save_diagnostics(raw, diagnostics)
    db.commit()
    return RawDocumentActionResult(
        raw_document_id=raw.id,
        status="parser_pending_admin",
        message="Parser edits saved",
        diagnostics=diagnostics,
    )


@router.post("/raw-documents/{raw_document_id}/run-ai", response_model=RawDocumentActionResult)
def run_ai(
    raw_document_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> RawDocumentActionResult:
    raw, _source = _get_raw_document(db, raw_document_id)
    parsed_payload = _parsed_payload(raw)
    extraction, ai_result = run_official_job_ai_extraction(db, parsed_payload)
    diagnostics = _diagnostics(raw)
    status = "fallback_ready_pending_publish" if ai_result.get("fallback_used") else "ai_completed_pending_publish"
    diagnostics["ai"] = {
        "status": status,
        "provider": ai_result.get("provider"),
        "model": ai_result.get("model"),
        "prompt_version": ai_result.get("prompt_version"),
        "input_payload": ai_result.get("input_payload"),
        "raw_output": ai_result.get("raw_output"),
        "validated_output": ai_result.get("validated_output"),
        "validation_errors": ai_result.get("validation_errors", []),
        "repair_attempted": ai_result.get("repair_attempted", False),
        "repair_success": ai_result.get("repair_success", False),
    }
    diagnostics["final_record"] = {
        **(diagnostics.get("final_record") or {}),
        "status": status,
        "published": False,
        "fallback_used": bool(ai_result.get("fallback_used")),
    }
    _save_diagnostics(raw, diagnostics)
    _append_attempt(raw, extraction=extraction, review_reason=status)
    db.commit()
    return RawDocumentActionResult(
        raw_document_id=raw.id,
        status=status,
        message="AI extraction completed",
        diagnostics=diagnostics,
    )


@router.post("/raw-documents/{raw_document_id}/use-fallback", response_model=RawDocumentActionResult)
def use_fallback(
    raw_document_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> RawDocumentActionResult:
    raw, _source = _get_raw_document(db, raw_document_id)
    parsed_payload = _parsed_payload(raw)
    extraction = official_parsed_payload_to_fallback_extraction(parsed_payload)
    diagnostics = _diagnostics(raw)
    diagnostics["ai"] = {
        **(diagnostics.get("ai") or {}),
        "status": "fallback_ready_pending_publish",
        "input_payload": build_official_job_ai_input_payload(parsed_payload),
        "raw_output": None,
        "validated_output": extraction.model_dump(mode="json"),
        "validation_errors": [],
        "repair_attempted": False,
        "repair_success": False,
    }
    diagnostics["final_record"] = {
        **(diagnostics.get("final_record") or {}),
        "status": "fallback_ready_pending_publish",
        "published": False,
        "fallback_used": True,
    }
    _save_diagnostics(raw, diagnostics)
    _append_attempt(raw, extraction=extraction, review_reason="fallback_ready_pending_publish")
    db.commit()
    return RawDocumentActionResult(
        raw_document_id=raw.id,
        status="fallback_ready_pending_publish",
        message="Deterministic fallback prepared",
        diagnostics=diagnostics,
    )


@router.post("/raw-documents/{raw_document_id}/publish", response_model=RawDocumentActionResult)
def publish_raw_document(
    raw_document_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
) -> RawDocumentActionResult:
    raw, source = _get_raw_document(db, raw_document_id)
    diagnostics = _diagnostics(raw)
    validated_payload = ((diagnostics.get("ai") or {}).get("validated_output") or {})
    fallback_used = bool((diagnostics.get("final_record") or {}).get("fallback_used"))
    if validated_payload:
        extraction = official_parsed_payload_to_fallback_extraction(_parsed_payload(raw)) if validated_payload.get("extraction_method") == "official_parsed_fallback" else None
        if extraction is None:
            from app.ingestion.schemas import JobOpportunityExtraction

            extraction = JobOpportunityExtraction.model_validate(validated_payload)
    else:
        fallback_used = True
        extraction = official_parsed_payload_to_fallback_extraction(_parsed_payload(raw))
    opportunity = _upsert_official_opportunity(
        db,
        source=source,
        raw=raw,
        extraction=extraction,
        publish=True,
        admin_id=admin.id,
    )
    diagnostics["final_record"] = {
        "opportunity_id": opportunity.id,
        "status": "published",
        "published": True,
        "fallback_used": fallback_used,
    }
    _save_diagnostics(raw, diagnostics)
    db.commit()
    return RawDocumentActionResult(
        raw_document_id=raw.id,
        status="published",
        message="Opportunity published",
        opportunity_id=opportunity.id,
        diagnostics=diagnostics,
    )
