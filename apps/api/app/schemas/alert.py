from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.schemas.common import Page


class AlertRuleCreate(BaseModel):
    name: str
    query_text: str
    filter_json: dict[str, Any] = {}
    is_active: bool = True


class AlertRuleUpdate(BaseModel):
    name: str | None = None
    query_text: str | None = None
    filter_json: dict[str, Any] | None = None
    is_active: bool | None = None


class AlertRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    query_text: str
    filter_json: dict[str, Any]
    is_active: bool
    last_run_at: datetime | None
    created_at: datetime


class AlertRulePage(Page[AlertRuleOut]):
    pass
