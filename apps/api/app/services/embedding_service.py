from __future__ import annotations

import logging

from fastembed import TextEmbedding

logger = logging.getLogger(__name__)

# Ordered preference list — first match in the fastembed supported list wins.
_PREFERRED_MODELS = [
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    "intfloat/multilingual-e5-small",
    "intfloat/multilingual-e5-base",
    "BAAI/bge-small-en-v1.5",
    "sentence-transformers/all-MiniLM-L6-v2",
]

EMBEDDING_DIMENSION = 384
EMBEDDING_MODEL = _PREFERRED_MODELS[0]  # updated to the actual chosen model on first init

_model: TextEmbedding | None = None


def _get_model() -> TextEmbedding:
    global _model, EMBEDDING_MODEL
    if _model is not None:
        return _model
    supported = {m["model"] for m in TextEmbedding.list_supported_models()}
    chosen = next((m for m in _PREFERRED_MODELS if m in supported), None)
    if chosen is None:
        chosen = next(iter(supported))
        logger.warning("embedding_no_preferred_model_available; using %s", chosen)
    elif chosen != _PREFERRED_MODELS[0]:
        logger.warning("embedding_model_fallback preferred=%s using=%s", _PREFERRED_MODELS[0], chosen)
    else:
        logger.info("embedding_model_loaded model=%s", chosen)
    EMBEDDING_MODEL = chosen
    _model = TextEmbedding(chosen)
    return _model


def embed_text(text: str) -> list[float]:
    if not text.strip():
        return [0.0] * EMBEDDING_DIMENSION
    result = list(_get_model().embed([text]))
    return result[0].tolist()


def embed_query(text: str) -> list[float]:
    if not text.strip():
        return [0.0] * EMBEDDING_DIMENSION
    result = list(_get_model().embed([text]))
    return result[0].tolist()
