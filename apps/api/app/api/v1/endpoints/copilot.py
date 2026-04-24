from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.rate_limit import enforce_copilot_rate_limit
from app.db.session import get_db
from app.schemas.copilot import (
    CopilotCompareRequest,
    CopilotExplainMatchRequest,
    CopilotQueryRequest,
    CopilotResponse,
)
from app.services.copilot_service import compare_opportunities, explain_match, run_copilot_query

router = APIRouter(prefix="/copilot", tags=["copilot"])


@router.post("/query", response_model=CopilotResponse)
def query(
    payload: CopilotQueryRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> CopilotResponse:
    enforce_copilot_rate_limit(request)
    return run_copilot_query(db, payload.question)


@router.post("/compare", response_model=CopilotResponse)
def compare(
    payload: CopilotCompareRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> CopilotResponse:
    enforce_copilot_rate_limit(request)
    return compare_opportunities(db, payload.left_opportunity_id, payload.right_opportunity_id)


@router.post("/explain-match", response_model=CopilotResponse)
def explain(
    payload: CopilotExplainMatchRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> CopilotResponse:
    enforce_copilot_rate_limit(request)
    return explain_match(db, payload.opportunity_id)
