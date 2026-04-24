import hashlib

EMBEDDING_DIMENSION = 1024
EMBEDDING_MODEL = "hash-embedding-v1"


def embed_text(text: str) -> list[float]:
    if not text.strip():
        return [0.0] * EMBEDDING_DIMENSION

    digest = hashlib.sha512(text.encode("utf-8")).digest()
    values: list[float] = []
    for i in range(EMBEDDING_DIMENSION):
        byte = digest[i % len(digest)]
        values.append((byte / 255.0) * 2 - 1)
    return values
