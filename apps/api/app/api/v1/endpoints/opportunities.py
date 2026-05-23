from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user_optional, get_db
from app.models.entities import Opportunity, Source, User
from app.schemas.opportunity import (
    OpportunityCategorySummary,
    OpportunityQuickAccessSummary,
    PublishedOpportunityDetail,
    PublishedSearchQuery,
    PublishedSearchResponse,
    SimilarOpportunityResponse,
)
from app.services.search_service import (
    get_opportunity_categories,
    get_opportunity_quick_access,
    get_similar_opportunities,
    search_opportunities,
)

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


@router.get("/search", response_model=PublishedSearchResponse)
def search(
    q: str | None = None,
    opportunity_type: str | None = None,
    country: str | None = None,
    destination_country: str | None = None,
    can_apply_from_bd: bool | None = None,
    open_to_international_candidates: bool | None = None,
    requires_existing_work_permit: bool | None = None,
    lmia_status: str | None = None,
    official_sources_only: bool = False,
    source_type: str | None = None,
    sector: str | None = None,
    isc_category_key: str | None = None,
    skill_level: str | None = None,
    education_level: str | None = None,
    experience_max: float | None = None,
    bangladesh_applicability: str | None = None,
    source: str | None = None,
    trust_score_min: float | None = None,
    deadline_from: str | None = None,
    deadline_to: str | None = None,
    deadline_within: int | None = None,
    salary_min: float | None = None,
    salary_max: float | None = None,
    fresh_days: int | None = None,
    saved_only: bool = False,
    sort: str = "relevance",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> PublishedSearchResponse:
    from datetime import date as dt_date, timedelta
    resolved_deadline_to = (
        dt_date.fromisoformat(deadline_to) if deadline_to
        else (dt_date.today() + timedelta(days=deadline_within)) if deadline_within
        else None
    )
    query = PublishedSearchQuery(
        q=q,
        opportunity_type=opportunity_type,
        country=country,
        destination_country=destination_country,
        can_apply_from_bd=can_apply_from_bd,
        open_to_international_candidates=open_to_international_candidates,
        requires_existing_work_permit=requires_existing_work_permit,
        lmia_status=lmia_status,
        official_sources_only=official_sources_only,
        source_type=source_type,
        sector=sector,
        isc_category_key=isc_category_key,
        skill_level=skill_level,
        education_level=education_level,
        experience_max=experience_max,
        bangladesh_applicability=bangladesh_applicability,
        source=source,
        trust_score_min=trust_score_min,
        deadline_from=dt_date.fromisoformat(deadline_from) if deadline_from else None,
        deadline_to=resolved_deadline_to,
        salary_min=salary_min,
        salary_max=salary_max,
        fresh_days=fresh_days,
        saved_only=saved_only,
        sort=sort,
        page=page,
        page_size=page_size,
    )
    return search_opportunities(db, query, user_id=user.id if user else None)


@router.get("/categories", response_model=list[OpportunityCategorySummary])
def categories(db: Session = Depends(get_db)) -> list[OpportunityCategorySummary]:
    return get_opportunity_categories(db)


@router.get("/quick-access", response_model=list[OpportunityQuickAccessSummary])
def quick_access(db: Session = Depends(get_db)) -> list[OpportunityQuickAccessSummary]:
    return get_opportunity_quick_access(db)


@router.get("/{opportunity_id}", response_model=PublishedOpportunityDetail)
def get_opportunity(opportunity_id: int, db: Session = Depends(get_db)) -> PublishedOpportunityDetail:
    opp = db.scalar(
        select(Opportunity).where(
            Opportunity.id == opportunity_id,
            Opportunity.status == "published",
            Opportunity.is_active.is_(True),
            Opportunity.admin_status.notin_(["hidden", "archived", "inactive", "rejected"]),
        )
    )
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    extracted = opp.extracted_json if isinstance(opp.extracted_json, dict) else {}
    return PublishedOpportunityDetail(
        id=opp.id,
        title=opp.title,
        title_bn=opp.title_bn,
        title_en=opp.title_en,
        opportunity_type=opp.opportunity_type,
        country=opp.country,
        destination_country=opp.destination_country,
        employer_or_organization=opp.employer_or_organization,
        sector=opp.sector,
        isc_category_key=opp.isc_category_key,
        platform_category_bn=opp.platform_category_bn,
        platform_category_en=opp.platform_category_en,
        salary_min=float(opp.salary_min) if opp.salary_min is not None else None,
        salary_max=float(opp.salary_max) if opp.salary_max is not None else None,
        salary_currency=opp.salary_currency,
        salary_text=opp.salary_text,
        salary_text_bn=opp.salary_text_bn,
        salary_text_en=opp.salary_text_en,
        deadline=opp.deadline,
        source_page_url=opp.source_page_url or "",
        document_url=opp.document_url,
        original_apply_url=opp.original_apply_url,
        content_type=opp.content_type,
        source_name=opp.source_name,
        source_trust_badge=opp.source_trust_badge,
        can_apply_from_bd=opp.can_apply_from_bd,
        requires_existing_work_permit=opp.requires_existing_work_permit,
        open_to_international_candidates=opp.open_to_international_candidates,
        open_to_authorized_workers_only=opp.open_to_authorized_workers_only,
        lmia_status=opp.lmia_status,
        eligibility_status=opp.eligibility_status,
        target_audience_tags=opp.target_audience_tags or [],
        risk_flags=opp.risk_flags or [],
        trust_score=opp.trust_score,
        bangladesh_applicability=opp.bangladesh_applicability,
        rural_user_fit_score=opp.rural_user_fit_score,
        actionability_score=opp.actionability_score,
        overall_rank_score=opp.overall_rank_score,
        published_at=opp.published_at,
        is_saved=False,
        why_this_matches="",
        summary=opp.summary_bn or opp.summary_en,
        summary_bn=opp.summary_bn,
        source_url=opp.source_page_url or "",
        is_active=opp.status == "published",
        # detail-only fields
        summary_en=opp.summary_en,
        job_title=opp.job_title,
        skill_level=opp.skill_level,
        education_min=opp.education_min,
        experience_min_years=opp.experience_min_years,
        extraction_warnings=opp.extraction_warnings or [],
        location_text=opp.location_text,
        location_text_bn=opp.location_text_bn,
        location_text_en=opp.location_text_en,
        posted_date=opp.posted_date,
        eligibility_text=opp.eligibility_text,
        eligibility_text_bn=opp.eligibility_text_bn,
        eligibility_text_en=opp.eligibility_text_en,
        required_documents=opp.required_documents,
        required_documents_bn=opp.required_documents_bn,
        required_documents_en=opp.required_documents_en,
        application_process=opp.application_process,
        application_process_bn=opp.application_process_bn,
        application_process_en=opp.application_process_en,
        education_requirement=opp.education_requirement,
        education_requirement_bn=opp.education_requirement_bn,
        education_requirement_en=opp.education_requirement_en,
        experience_requirement=opp.experience_requirement,
        experience_requirement_bn=opp.experience_requirement_bn,
        experience_requirement_en=opp.experience_requirement_en,
        language_requirement=opp.language_requirement,
        language_requirement_bn=opp.language_requirement_bn,
        language_requirement_en=opp.language_requirement_en,
        age_requirement=opp.age_requirement,
        gender_requirement=opp.gender_requirement,
        visa_or_work_permit_info=opp.visa_or_work_permit_info,
        visa_or_work_permit_info_bn=opp.visa_or_work_permit_info_bn,
        visa_or_work_permit_info_en=opp.visa_or_work_permit_info_en,
        journey_steps=opp.journey_steps or [],
        journey_steps_bn=opp.journey_steps_bn or [],
        journey_steps_en=opp.journey_steps_en or [],
        documents_needed=opp.documents_needed or [],
        documents_needed_bn=opp.documents_needed_bn or [],
        documents_needed_en=opp.documents_needed_en or [],
        typical_salary_bdt=opp.typical_salary_bdt,
        extraction_confidence=opp.extraction_confidence,
        connector_key=opp.connector_key,
        created_at=opp.created_at,
        updated_at=opp.updated_at,
        draft_id=opp.id,
        source_id=opp.source_id,
        employer=opp.employer,
        organization=opp.organization,
        city=opp.city,
        application_url=opp.application_url,
        funding_type=opp.funding_type,
        visa_support=opp.visa_support,
        record_type=opp.record_type,
        trust_tier=opp.source.trust_tier if opp.source else None,
        requirements_json=opp.requirements_json,
        benefits_json=opp.benefits_json,
        language_requirements_json=opp.language_requirements_json,
        job_purpose=extracted.get("job_purpose"),
        responsibilities=extracted.get("responsibilities") or [],
        key_accountabilities=extracted.get("key_accountabilities") or [],
        role_accountabilities=extracted.get("role_accountabilities") or [],
        qualifications=extracted.get("qualifications") or [],
        skills=extracted.get("skills") or [],
        work_conditions=extracted.get("work_conditions") or [],
        source_sections=extracted.get("source_sections") or (opp.requirements_json or {}).get("source_sections") or [],
        mirror_urls=opp.mirror_urls or [],
    )


@router.get("/{opportunity_id}/similar", response_model=SimilarOpportunityResponse)
def similar(opportunity_id: int, db: Session = Depends(get_db)) -> SimilarOpportunityResponse:
    return SimilarOpportunityResponse(items=get_similar_opportunities(db, opportunity_id))


@router.get("/{opportunity_id}/source")
def source_info(opportunity_id: int, db: Session = Depends(get_db)) -> dict:
    opp = db.scalar(select(Opportunity).where(Opportunity.id == opportunity_id))
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    src = db.scalar(select(Source).where(Source.id == opp.source_id))
    return {
        "source_id": opp.source_id,
        "source_name": opp.source_name,
        "source_page_url": opp.source_page_url,
        "trust_level": src.trust_level if src else None,
        "trust_badge": opp.source_trust_badge,
        "connector_key": opp.connector_key,
    }
