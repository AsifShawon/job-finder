from datetime import datetime

from pydantic import BaseModel


class CopilotCitation(BaseModel):
    opportunity_id: int
    title: str
    source_url: str
    trust_tier: str
    fetched_at: datetime | None
    extraction_confidence: float


class CopilotQueryRequest(BaseModel):
    question: str
    top_k: int = 5


class CopilotExplainMatchRequest(BaseModel):
    opportunity_id: int


class CopilotCompareRequest(BaseModel):
    left_opportunity_id: int
    right_opportunity_id: int


class CopilotResponse(BaseModel):
    answer: str
    citations: list[CopilotCitation]
    unsupported_claims_blocked: bool = True
