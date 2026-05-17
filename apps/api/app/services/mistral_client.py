"""Shared Mistral API client helpers using the official mistralai SDK.

All Mistral API calls in the platform go through these functions so there is
one place to update model names, timeouts, retry behaviour, and error handling.

Default model: mistral-small-latest (fast, cheap, capable enough for our tasks)
"""
from __future__ import annotations

import json
import logging
from typing import Any, TypeVar

from mistralai import Mistral
from pydantic import BaseModel

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


def _client(api_key: str) -> Mistral:
    return Mistral(api_key=api_key)


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

    response = client.chat.complete(**kwargs)
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
