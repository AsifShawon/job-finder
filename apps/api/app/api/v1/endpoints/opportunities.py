from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user_optional
from app.db.session import get_db
from app.models.entities import Opportunity, RawDocument, Source, User
from app.models.enums import RecordType, SourceClass, TrustTier
from app.schemas.opportunity import (
    OpportunityOut,
    OpportunitySearchQuery,
    OpportunitySearchResponse,
    OpportunitySourceResponse,
    SimilarOpportunityResponse,
)
from app.services.search_service import get_similar_opportunities, search_opportunities

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


@router.get("/search", response_model=OpportunitySearchResponse)
def search(
    q: str | None = None,
    semantic_q: str | None = None,
    record_type: RecordType | None = None,
    country: str | None = None,
    city: str | None = None,
    sector: str | None = None,
    source_class: SourceClass | None = None,
    trust_tier: TrustTier | None = None,
    visa_support: bool | None = None,
    degree_level: str | None = None,
    sort: str = "relevance",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    saved_only: bool = False,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> OpportunitySearchResponse:
    query = OpportunitySearchQuery(
        q=q,
        semantic_q=semantic_q,
        record_type=record_type,
        country=country,
        city=city,
        sector=sector,
        source_class=source_class,
        trust_tier=trust_tier,
        visa_support=visa_support,
        degree_level=degree_level,
        sort=sort,
        page=page,
        page_size=page_size,
        saved_only=saved_only,
    )
    return search_opportunities(db, query, user_id=user.id if user else None)


@router.get("/{opportunity_id}", response_model=OpportunityOut)
def get_opportunity(opportunity_id: int, db: Session = Depends(get_db)) -> OpportunityOut:
    opp = db.scalar(select(Opportunity).where(Opportunity.id == opportunity_id))
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return opp


@router.get("/{opportunity_id}/similar", response_model=SimilarOpportunityResponse)
def similar(opportunity_id: int, db: Session = Depends(get_db)) -> SimilarOpportunityResponse:
    return SimilarOpportunityResponse(items=get_similar_opportunities(db, opportunity_id))


@router.get("/{opportunity_id}/source", response_model=OpportunitySourceResponse)
def source(opportunity_id: int, db: Session = Depends(get_db)) -> OpportunitySourceResponse:
    row = db.execute(
        select(Opportunity, Source, RawDocument)
        .join(Source, Source.id == Opportunity.source_id)
        .outerjoin(RawDocument, RawDocument.id == Opportunity.raw_document_id)
        .where(Opportunity.id == opportunity_id)
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    opp, src, raw = row
    return OpportunitySourceResponse(
        source_id=src.id,
        source_name=src.name,
        source_url=opp.source_url,
        trust_tier=src.trust_tier,
        source_class=src.source_class,
        fetched_at=raw.fetched_at if raw else None,
    )


