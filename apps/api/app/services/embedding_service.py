from __future__ import annotations

from fastembed import TextEmbedding

EMBEDDING_MODEL = "intfloat/multilingual-e5-small"
EMBEDDING_DIMENSION = 384

_model: TextEmbedding | None = None


def _get_model() -> TextEmbedding:
    global _model
    if _model is None:
        _model = TextEmbedding(EMBEDDING_MODEL)
    return _model


def embed_text(text: str) -> list[float]:
    """Embed a passage (document being indexed)."""
    if not text.strip():
        return [0.0] * EMBEDDING_DIMENSION
    result = list(_get_model().embed([f"passage: {text}"]))
    return result[0].tolist()


def embed_query(text: str) -> list[float]:
    """Embed a search query. Uses 'query:' prefix for better retrieval with multilingual-e5."""
    if not text.strip():
        return [0.0] * EMBEDDING_DIMENSION
    result = list(_get_model().embed([f"query: {text}"]))
    return result[0].tolist()
