from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.entities import Opportunity, SavedOpportunity, User
from app.schemas.opportunity import OpportunityCard

router = APIRouter(prefix="/saved", tags=["saved"])


@router.post("/{opportunity_id}", response_model=dict)
def save(opportunity_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    exists = db.scalar(select(Opportunity).where(Opportunity.id == opportunity_id))
    if not exists:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    row = db.scalar(
        select(SavedOpportunity).where(
            SavedOpportunity.user_id == user.id,
            SavedOpportunity.opportunity_id == opportunity_id,
        )
    )
    if row:
        return {"message": "Already saved"}

    db.add(SavedOpportunity(user_id=user.id, opportunity_id=opportunity_id))
    db.commit()
    return {"message": "Saved"}


@router.delete("/{opportunity_id}", response_model=dict)
def unsave(opportunity_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    row = db.scalar(
        select(SavedOpportunity).where(
            SavedOpportunity.user_id == user.id,
            SavedOpportunity.opportunity_id == opportunity_id,
        )
    )
    if not row:
        return {"message": "Not saved"}

    db.delete(row)
    db.commit()
    return {"message": "Removed"}


@router.get("", response_model=list[OpportunityCard])
def list_saved(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[OpportunityCard]:
    rows = db.execute(
        select(Opportunity)
        .join(SavedOpportunity, SavedOpportunity.opportunity_id == Opportunity.id)
        .where(SavedOpportunity.user_id == user.id)
    ).scalars()

    cards: list[OpportunityCard] = []
    for opp in rows:
        cards.append(
            OpportunityCard(
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
                why_this_matches="Saved by user",
                is_saved=True,
            )
        )
    return cards
