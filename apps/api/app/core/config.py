from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Overseas Opportunity Intelligence Platform for Bangladeshis"
    environment: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"

    secret_key: str
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    database_url: str
    redis_url: str

    ai_provider: str = "mistral"
    ai_model: str = ""
    ai_api_key: str = ""

    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    mistral_api_key: str = ""
    mistral_model: str = "mistral-small-latest"

    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "raw-docs"
    minio_secure: bool = False

    crawler_user_agent: str = "OOI-Platform/1.0 (+https://localhost)"
    enable_scheduled_crawls: bool = False
    crawler_smoke_mode: bool = False
    reliefweb_appname: str = "ooi-bd-opportunities-dev"
    search_provider: str = "searxng"
    search_provider_base_url: str = ""
    search_provider_api_key: str = ""
    search_provider_timeout_seconds: int = 15
    rate_limit_copilot: str = "20/minute"
    web_base_url: str = "http://localhost:3000"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@sudokkho.xyz"
    smtp_tls: bool = True

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[arg-type]
