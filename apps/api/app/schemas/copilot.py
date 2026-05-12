from datetime import datetime

from pydantic import BaseModel, Field


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


class CopilotSuggestedFollowUp(BaseModel):
    text: str = Field(min_length=1, max_length=220)


class CopilotChatCitation(BaseModel):
    opportunity_id: int
    title: str
    title_bn: str | None = None
    title_en: str | None = None
    opportunity_type: str | None = None
    country: str | None = None
    destination_country: str | None = None
    deadline: str | None = None
    employer_or_organization: str | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    salary_currency: str | None = None
    salary_text: str | None = None
    salary_text_bn: str | None = None
    can_apply_from_bd: bool | None = None
    source_trust_badge: str | None = None
    source_url: str = ""
    is_saved: bool = False
    why_this_matches: str = ""
    summary: str | None = None
    summary_bn: str | None = None


class CopilotChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    locale: str = "bn"


class CopilotChatResponse(BaseModel):
    message_id: int | None = None
    answer: str
    locale: str
    citations: list[CopilotChatCitation] = Field(default_factory=list)
    suggested_follow_ups: list[CopilotSuggestedFollowUp] = Field(default_factory=list)


class CopilotConversationListItem(BaseModel):
    id: int
    title: str
    locale: str
    last_message_preview: str | None = None
    updated_at: datetime
    last_message_at: datetime


class CopilotMessageOut(BaseModel):
    id: int
    role: str
    content: str
    citations: list[CopilotChatCitation] = Field(default_factory=list)
    suggested_follow_ups: list[CopilotSuggestedFollowUp] = Field(default_factory=list)
    created_at: datetime


class CopilotConversationDetail(BaseModel):
    id: int
    title: str
    locale: str
    created_at: datetime
    updated_at: datetime
    last_message_at: datetime
    messages: list[CopilotMessageOut] = Field(default_factory=list)


class CopilotConversationCreateRequest(BaseModel):
    locale: str = "bn"


class CopilotConversationMessageCreateRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    locale: str | None = None
