from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.entities import AppSetting

GROQ_API_KEY = "groq_api_key"
GROQ_MODEL = "groq_model"

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


def get_groq_api_key(db: Session) -> str:
    return get_setting(db, GROQ_API_KEY) or settings.groq_api_key


def get_groq_model(db: Session) -> str:
    return get_setting(db, GROQ_MODEL) or settings.groq_model


def has_groq_api_key(db: Session) -> bool:
    return bool(get_groq_api_key(db))
