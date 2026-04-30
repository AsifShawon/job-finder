from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.entities import User
from app.schemas.opportunity import RecommendationCard, RecommendationResponse
from app.services.recommendation_service import get_recommendations

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("", response_model=RecommendationResponse)
def recommendations(
    page: int = 1,
    page_size: int = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RecommendationResponse:
    items, total = get_recommendations(db, user.id, page=page, page_size=page_size)
    cards = [
        RecommendationCard(
            id=opp.id,
            title=opp.title,
            summary=opp.summary,
            record_type=opp.record_type,
            organization=opp.organization,
            employer=opp.employer,
            country=opp.country,
            city=opp.city,
            deadline=opp.deadline,
            salary_min=float(opp.salary_min) if opp.salary_min is not None else None,
            salary_max=float(opp.salary_max) if opp.salary_max is not None else None,
            salary_currency=opp.salary_currency,
            funding_type=opp.funding_type,
            trust_score=opp.trust_score,
            source_class=opp.source.source_class,
            trust_tier=opp.source.trust_tier,
            source_url=opp.source_url,
            why_this_matches="",
            is_saved=is_saved,
            match_score=match_score,
            isc_match_key=isc_match_key,
            created_at=opp.created_at,
        )
        for opp, match_score, is_saved, isc_match_key in items
    ]
    return RecommendationResponse(items=cards, total=total, page=page, page_size=page_size)
