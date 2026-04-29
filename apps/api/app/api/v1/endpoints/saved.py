from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.entities import Opportunity, SavedOpportunity, User
from app.schemas.opportunity import PublishedOpportunityCard

router = APIRouter(prefix="/saved", tags=["saved"])


@router.post("/{opportunity_id}", response_model=dict)
def save(
    opportunity_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    opp = db.scalar(
        select(Opportunity).where(
            Opportunity.id == opportunity_id,
            Opportunity.status == "published",
        )
    )
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    existing = db.scalar(
        select(SavedOpportunity).where(
            SavedOpportunity.user_id == user.id,
            SavedOpportunity.opportunity_id == opportunity_id,
        )
    )
    if existing:
        return {"message": "Already saved"}

    db.add(SavedOpportunity(user_id=user.id, opportunity_id=opportunity_id))
    db.commit()
    return {"message": "Saved"}


@router.delete("/{opportunity_id}", response_model=dict)
def unsave(
    opportunity_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
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


@router.get("", response_model=list[PublishedOpportunityCard])
def list_saved(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[PublishedOpportunityCard]:
    opps = db.scalars(
        select(Opportunity)
        .join(SavedOpportunity, SavedOpportunity.opportunity_id == Opportunity.id)
        .where(SavedOpportunity.user_id == user.id)
        .where(Opportunity.status == "published")
        .order_by(SavedOpportunity.created_at.desc())
    ).all()

    return [
        PublishedOpportunityCard(
            id=p.id, title=p.title, title_bn=p.title_bn,
            opportunity_type=p.opportunity_type, country=p.country,
            destination_country=p.destination_country,
            employer_or_organization=p.employer_or_organization,
            sector=p.sector,
            salary_min=float(p.salary_min) if p.salary_min is not None else None,
            salary_max=float(p.salary_max) if p.salary_max is not None else None,
            salary_currency=p.salary_currency, salary_text=p.salary_text,
            deadline=p.deadline, source_page_url=p.source_page_url or "",
            document_url=p.document_url, original_apply_url=p.original_apply_url,
            content_type=p.content_type, source_name=p.source_name,
            source_trust_badge=p.source_trust_badge,
            can_apply_from_bd=p.can_apply_from_bd,
            requires_existing_work_permit=p.requires_existing_work_permit,
            open_to_international_candidates=p.open_to_international_candidates,
            open_to_authorized_workers_only=p.open_to_authorized_workers_only,
            lmia_status=p.lmia_status, eligibility_status=p.eligibility_status,
            target_audience_tags=p.target_audience_tags or [],
            risk_flags=p.risk_flags or [],
            trust_score=p.trust_score, overall_rank_score=p.overall_rank_score,
            published_at=p.published_at, is_saved=True,
            why_this_matches="সংরক্ষিত সুযোগ",
            summary=p.summary_bn or p.summary_en, summary_bn=p.summary_bn,
            source_url=p.source_page_url or "", is_active=p.status == "published",
        )
        for p in opps
    ]
