import hashlib

import trafilatura

from app.ingestion.schemas import FetchedPage


def clean_page(page: FetchedPage) -> dict:
    text_source = page.raw_html or page.raw_text or ""
    cleaned = trafilatura.extract(text_source) or page.raw_text or ""
    return {
        "title": page.title,
        "body_text": cleaned,
        "canonical_url": page.canonical_url or page.url,
        "apply_link": page.metadata.get("apply_link") or page.canonical_url or page.url,
        "content_hash": hashlib.sha256(cleaned.encode("utf-8")).hexdigest(),
    }
