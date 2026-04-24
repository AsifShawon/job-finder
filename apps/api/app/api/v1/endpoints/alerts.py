from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.entities import AlertRule, User
from app.schemas.alert import AlertRuleCreate, AlertRuleOut, AlertRulePage, AlertRuleUpdate

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("", response_model=AlertRuleOut)
def create_alert(payload: AlertRuleCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> AlertRuleOut:
    rule = AlertRule(
        user_id=user.id,
        name=payload.name,
        query_text=payload.query_text,
        filter_json=payload.filter_json,
        is_active=payload.is_active,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.get("", response_model=AlertRulePage)
def list_alerts(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AlertRulePage:
    stmt = select(AlertRule).where(AlertRule.user_id == user.id).order_by(AlertRule.created_at.desc())
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return AlertRulePage(items=items, total=total, page=page, page_size=page_size)


@router.patch("/{alert_id}", response_model=AlertRuleOut)
def update_alert(
    alert_id: int,
    payload: AlertRuleUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AlertRuleOut:
    rule = db.scalar(select(AlertRule).where(AlertRule.id == alert_id, AlertRule.user_id == user.id))
    if not rule:
        raise HTTPException(status_code=404, detail="Alert not found")

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(rule, key, value)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{alert_id}", response_model=dict)
def delete_alert(alert_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    rule = db.scalar(select(AlertRule).where(AlertRule.id == alert_id, AlertRule.user_id == user.id))
    if not rule:
        return {"message": "Not found"}

    db.delete(rule)
    db.commit()
    return {"message": "Deleted"}
