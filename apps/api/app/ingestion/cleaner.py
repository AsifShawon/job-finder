import hashlib

import trafilatura

from app.ingestion.schemas import FetchedPage

_PDF_CONTENT_TYPES = {"pdf", "image_pdf"}


def clean_page(page: FetchedPage) -> dict:
    if page.content_type in _PDF_CONTENT_TYPES or (page.raw_html is None and page.raw_text):
        # PDF content: trafilatura is an HTML extractor and cannot process raw PDF text.
        # Build body_text by prepending any English metadata from the connector so the
        # LLM has reliable anchors (country, deadline, apply URL) even when the OCR body
        # is Bengali script that the prompt's keyword checks wouldn't otherwise match.
        parts: list[str] = []
        if page.title:
            parts.append(f"Title: {page.title}")
        meta = page.metadata or {}
        if meta.get("country"):
            parts.append(f"Destination Country: {meta['country']}")
        if meta.get("closing_date"):
            parts.append(f"Application Deadline: {meta['closing_date']}")
        if page.original_apply_url:
            parts.append(f"Application URL: {page.original_apply_url}")
        if meta.get("source"):
            parts.append(f"Source: {meta['source']}")
        if parts:
            parts.append("")  # blank line before PDF body
        parts.append(page.raw_text or "")
        body_text = "\n".join(parts)
    else:
        text_source = page.raw_html or page.raw_text or ""
        body_text = trafilatura.extract(text_source) or page.raw_text or ""

    return {
        "title": page.title,
        "body_text": body_text,
        "canonical_url": page.canonical_url or page.url,
        "apply_link": (page.metadata or {}).get("apply_link") or page.canonical_url or page.url,
        "content_hash": hashlib.sha256(body_text.encode("utf-8")).hexdigest(),
    }
