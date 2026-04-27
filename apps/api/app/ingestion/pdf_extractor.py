from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.core.config import get_settings

settings = get_settings()

_MIN_TEXT_CHARS = 150
_MAX_PDF_BYTES = 20 * 1024 * 1024  # 20 MB
_OCR_DPI = 200


@dataclass
class PDFExtractionResult:
    text: str
    used_ocr: bool
    page_count: int
    content_type: str  # "pdf" (text layer found) or "image_pdf" (OCR used)


def download_pdf(url: str) -> bytes:
    """Stream-download a PDF with a 20 MB safety cap."""
    with httpx.Client(
        timeout=30.0,
        follow_redirects=True,
        headers={"User-Agent": settings.crawler_user_agent},
    ) as client:
        with client.stream("GET", url) as resp:
            resp.raise_for_status()
            chunks: list[bytes] = []
            total = 0
            for chunk in resp.iter_bytes(8192):
                chunks.append(chunk)
                total += len(chunk)
                if total > _MAX_PDF_BYTES:
                    raise ValueError(f"PDF exceeds 20 MB limit: {url}")
            return b"".join(chunks)


def extract_text(pdf_bytes: bytes) -> PDFExtractionResult:
    """Extract text from a PDF.

    Tries PyMuPDF direct text extraction first.  Falls back to Tesseract OCR
    (Bengali + English) when the direct layer yields fewer than _MIN_TEXT_CHARS.
    """
    import fitz  # PyMuPDF

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page_count = doc.page_count

    pages_text = [page.get_text() for page in doc]
    full_text = "\n".join(pages_text).strip()

    if len(full_text) >= _MIN_TEXT_CHARS:
        doc.close()
        return PDFExtractionResult(
            text=full_text,
            used_ocr=False,
            page_count=page_count,
            content_type="pdf",
        )

    try:
        ocr_text = _ocr_pages(doc)
        doc.close()
        return PDFExtractionResult(
            text=ocr_text,
            used_ocr=True,
            page_count=page_count,
            content_type="image_pdf",
        )
    except Exception:
        doc.close()
        # Return whatever we have — pipeline will flag for admin review
        return PDFExtractionResult(
            text=full_text,
            used_ocr=False,
            page_count=page_count,
            content_type="image_pdf",
        )


def _ocr_pages(doc) -> str:  # type: ignore[no-untyped-def]
    import fitz
    import pytesseract
    from PIL import Image

    texts: list[str] = []
    for page in doc:
        mat = fitz.Matrix(_OCR_DPI / 72, _OCR_DPI / 72)
        pix = page.get_pixmap(matrix=mat)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        text = pytesseract.image_to_string(img, lang="ben+eng", config="--psm 3")
        texts.append(text)
    return "\n".join(texts).strip()
