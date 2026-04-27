from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user_optional, get_db
from app.models.entities import PublishedOpportunity, RawDocument, Source, User
from app.schemas.opportunity import (
    PublishedOpportunityDetail,
    PublishedSearchQuery,
    PublishedSearchResponse,
    SimilarOpportunityResponse,
)
from app.services.search_service import get_similar_opportunities, search_opportunities

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
    skill_level: str | None = None,
    deadline_from: str | None = None,
    deadline_to: str | None = None,
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
    from datetime import date as dt_date
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
        skill_level=skill_level,
        deadline_from=dt_date.fromisoformat(deadline_from) if deadline_from else None,
        deadline_to=dt_date.fromisoformat(deadline_to) if deadline_to else None,
        salary_min=salary_min,
        salary_max=salary_max,
        fresh_days=fresh_days,
        saved_only=saved_only,
        sort=sort,
        page=page,
        page_size=page_size,
    )
    return search_opportunities(db, query, user_id=user.id if user else None)


@router.get("/{opportunity_id}", response_model=PublishedOpportunityDetail)
def get_opportunity(opportunity_id: int, db: Session = Depends(get_db)) -> PublishedOpportunityDetail:
    pub = db.scalar(
        select(PublishedOpportunity).where(
            PublishedOpportunity.id == opportunity_id,
            PublishedOpportunity.is_active.is_(True),
        )
    )
    if not pub:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return PublishedOpportunityDetail.model_validate(pub)


@router.get("/{opportunity_id}/similar", response_model=SimilarOpportunityResponse)
def similar(opportunity_id: int, db: Session = Depends(get_db)) -> SimilarOpportunityResponse:
    return SimilarOpportunityResponse(items=get_similar_opportunities(db, opportunity_id))


@router.get("/{opportunity_id}/source")
def source_info(opportunity_id: int, db: Session = Depends(get_db)) -> dict:
    pub = db.scalar(select(PublishedOpportunity).where(PublishedOpportunity.id == opportunity_id))
    if not pub:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    src = db.scalar(select(Source).where(Source.id == pub.source_id))
    return {
        "source_id": pub.source_id,
        "source_name": pub.source_name,
        "source_page_url": pub.source_page_url,
        "trust_level": src.trust_level if src else None,
        "trust_badge": pub.source_trust_badge,
        "connector_key": pub.connector_key,
    }
