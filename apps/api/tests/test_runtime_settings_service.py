from __future__ import annotations

from unittest.mock import MagicMock

from app.services import runtime_settings_service as rss


def test_get_ai_provider_prefers_mistral_when_env_key_exists(monkeypatch) -> None:
    db = MagicMock()
    monkeypatch.setattr(rss, "get_setting", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(rss.settings, "ai_provider", "mistral")
    monkeypatch.setattr(rss.settings, "mistral_api_key", "mistral-secret")
    monkeypatch.setattr(rss.settings, "groq_api_key", "")

    assert rss.get_ai_provider(db) == "mistral"


def test_get_ai_provider_falls_back_to_mistral_when_groq_selected_without_key(monkeypatch) -> None:
    db = MagicMock()

    def fake_get_setting(_db, key: str):
        if key == rss.AI_PROVIDER:
            return "groq"
        if key == rss.MISTRAL_API_KEY:
            return "mistral-secret"
        return None

    monkeypatch.setattr(rss, "get_setting", fake_get_setting)
    monkeypatch.setattr(rss.settings, "ai_provider", "mistral")
    monkeypatch.setattr(rss.settings, "mistral_api_key", "")
    monkeypatch.setattr(rss.settings, "groq_api_key", "")

    assert rss.get_ai_provider(db) == "mistral"


def test_get_ai_api_key_uses_mistral_key_for_active_provider(monkeypatch) -> None:
    db = MagicMock()

    def fake_get_setting(_db, key: str):
        values = {
            rss.AI_PROVIDER: "mistral",
            rss.MISTRAL_API_KEY: "mistral-secret",
        }
        return values.get(key)

    monkeypatch.setattr(rss, "get_setting", fake_get_setting)
    monkeypatch.setattr(rss.settings, "mistral_api_key", "")
    monkeypatch.setattr(rss.settings, "groq_api_key", "")

    assert rss.get_ai_api_key(db) == "mistral-secret"
