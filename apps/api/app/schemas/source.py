from datetime import datetime

from pydantic import BaseModel, ConfigDict, HttpUrl

from app.models.enums import AccessMethod, SourceClass, TrustTier


class SourceBase(BaseModel):
    name: str
    base_url: HttpUrl
    country: str | None = "Bangladesh"
    source_class: SourceClass = SourceClass.news_policy
    trust_tier: TrustTier = TrustTier.news_only
    access_method: AccessMethod = AccessMethod.static_html
    crawl_frequency_minutes: int = 1440
    is_active: bool = True
    parser_key: str = "default"


class SourceCreate(SourceBase):
    pass


class SourceUpdate(BaseModel):
    name: str | None = None
    base_url: HttpUrl | None = None
    country: str | None = None
    source_class: SourceClass | None = None
    trust_tier: TrustTier | None = None
    access_method: AccessMethod | None = None
    crawl_frequency_minutes: int | None = None
    is_active: bool | None = None
    parser_key: str | None = None


class SourceOut(SourceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
