"""Shared Mistral API client helpers using the official mistralai SDK.

All Mistral API calls in the platform go through these functions so there is
one place to update model names, timeouts, retry behaviour, and error handling.

Default model: mistral-small-latest (fast, cheap, capable enough for our tasks)
"""
from __future__ import annotations

import importlib
import json
import logging
from typing import Any, TypeVar

from pydantic import BaseModel

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

def _resolve_mistral_client_class():
    """Support both top-level and nested SDK import layouts.

    Recent docs show both `from mistralai import Mistral` and
    `from mistralai.client import Mistral` depending on SDK generation/version.
    We resolve lazily so the app can import even when the provider is not used.
    """
    import_errors: list[str] = []
    for module_name, class_name in (
        ("mistralai", "Mistral"),
        ("mistralai.client", "Mistral"),
        ("mistralai.client", "MistralClient"),
    ):
        try:
            module = importlib.import_module(module_name)
            client_cls = getattr(module, class_name, None)
            if client_cls is not None:
                return client_cls
        except Exception as exc:  # pragma: no cover - depends on installed SDK layout
            import_errors.append(f"{module_name}.{class_name}: {type(exc).__name__}: {exc}")
    raise ImportError(
        "Unable to import a compatible Mistral SDK client. Tried mistralai.Mistral, "
        "mistralai.client.Mistral, and mistralai.client.MistralClient. "
        f"Details: {' | '.join(import_errors) or 'symbol not found'}"
    )


def _client(api_key: str):
    client_cls = _resolve_mistral_client_class()
    return client_cls(api_key=api_key)


def mistral_chat(
    api_key: str,
    model: str,
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.0,
    json_mode: bool = False,
) -> str:
    """Call Mistral chat completions and return the response text.

    Args:
        api_key: Mistral API key.
        model: Model ID, e.g. "mistral-small-latest".
        messages: List of {role, content} dicts.
        temperature: Sampling temperature.
        json_mode: If True, enables JSON response_format so the model always
                   returns valid JSON (still needs to be parsed by the caller).
    """
    client = _client(api_key)
    kwargs: dict[str, Any] = {
        "model": model,
        "temperature": temperature,
        "messages": messages,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    if hasattr(getattr(client, "chat", None), "complete"):
        response = client.chat.complete(**kwargs)
    elif callable(getattr(client, "chat", None)):  # older SDK layout
        response = client.chat(**kwargs)
    else:  # pragma: no cover - defensive guard for unexpected SDK shape
        raise RuntimeError("Unsupported Mistral SDK client shape: missing chat.complete/chat")
    return (response.choices[0].message.content or "").strip()


def mistral_chat_json(
    api_key: str,
    model: str,
    messages: list[dict[str, str]],
    output_model: type[T],
    *,
    temperature: float = 0.0,
) -> T:
    """Call Mistral with JSON mode and parse the result into a Pydantic model.

    Falls back to stripping code fences if the model wraps JSON in markdown.
    """
    raw = mistral_chat(api_key, model, messages, temperature=temperature, json_mode=True)
    cleaned = _strip_fences(raw)
    return output_model.model_validate(json.loads(cleaned))


def mistral_chat_text(
    api_key: str,
    model: str,
    prompt: str,
    *,
    temperature: float = 0.2,
) -> str:
    """Simple single-user-message text call (no JSON mode)."""
    return mistral_chat(
        api_key,
        model,
        [{"role": "user", "content": prompt}],
        temperature=temperature,
        json_mode=False,
    )


def _strip_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()
    return cleaned
