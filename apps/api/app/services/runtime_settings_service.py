from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.entities import AppSetting

AI_API_KEY = "ai_api_key"
AI_MODEL = "ai_model"
AI_PROVIDER = "ai_provider"
GROQ_API_KEY = "groq_api_key"
GROQ_MODEL = "groq_model"
MISTRAL_API_KEY = "mistral_api_key"
MISTRAL_MODEL = "mistral_model"

settings = get_settings()


def get_setting(db: Session, key: str) -> str | None:
    value = db.scalar(select(AppSetting.value).where(AppSetting.key == key))
    return value.strip() if value else None


def set_setting(db: Session, key: str, value: str) -> AppSetting:
    setting = db.get(AppSetting, key)
    if setting is None:
        setting = AppSetting(key=key, value=value)
        db.add(setting)
    else:
        setting.value = value
    db.commit()
    db.refresh(setting)
    return setting


def _provider_default_model(provider: str) -> str:
    if provider == "mistral":
        return settings.mistral_model
    return settings.groq_model


def get_ai_provider(db: Session) -> str:
    return (get_setting(db, AI_PROVIDER) or settings.ai_provider or "groq").strip().lower()


def get_ai_model(db: Session) -> str:
    model = get_setting(db, AI_MODEL)
    if model:
        return model
    return _provider_default_model(get_ai_provider(db))


def get_ai_api_key(db: Session) -> str:
    provider = get_ai_provider(db)
    if provider == "mistral":
        return get_setting(db, MISTRAL_API_KEY) or get_setting(db, AI_API_KEY) or settings.mistral_api_key
    return get_setting(db, GROQ_API_KEY) or get_setting(db, AI_API_KEY) or settings.groq_api_key


def has_ai_api_key(db: Session) -> bool:
    return bool(get_ai_api_key(db))


def get_groq_api_key(db: Session) -> str:
    return get_setting(db, GROQ_API_KEY) or settings.groq_api_key


def get_groq_model(db: Session) -> str:
    return get_setting(db, GROQ_MODEL) or settings.groq_model


def has_groq_api_key(db: Session) -> bool:
    return bool(get_groq_api_key(db))


def get_mistral_api_key(db: Session) -> str:
    return get_setting(db, MISTRAL_API_KEY) or settings.mistral_api_key


def get_mistral_model(db: Session) -> str:
    return get_setting(db, MISTRAL_MODEL) or settings.mistral_model


def has_mistral_api_key(db: Session) -> bool:
    return bool(get_mistral_api_key(db))
