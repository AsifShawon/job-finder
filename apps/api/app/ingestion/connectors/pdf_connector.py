from datetime import datetime

import logging

from app.core.config import get_settings
from app.ingestion.connectors.base import BaseSourceConnector
from app.ingestion.content_detector import detect as detect_content_type
from app.ingestion.pdf_extractor import PDFExtractionResult, download_pdf, extract_text
from app.ingestion.robots import is_allowed
from app.ingestion.schemas import FetchedPage
from app.models.entities import Source

settings = get_settings()
logger = logging.getLogger(__name__)


class PDFNoticeConnector(BaseSourceConnector):
    """Connector for sources whose base_url points directly at a PDF or at an
    HTML index page that links to PDF circulars.

    For direct-PDF URLs the file is downloaded and text is extracted via
    PyMuPDF (with Tesseract OCR fallback for image-only PDFs).
    """

    def discover_items(self, source: Source, crawl_mode: str = "active_only") -> list[FetchedPage]:
        return self.fetch(source, since=None)

    def fetch(self, source: Source, since: datetime | None = None) -> list[FetchedPage]:
        if not is_allowed(source.base_url, settings.crawler_user_agent):
            return []

        detected = detect_content_type(source.base_url)

        if detected == "pdf":
            return self._fetch_single_pdf(source.base_url, source_page_url=None)

        # Possibly an HTML index page — delegate to static discovery with PDF detection
        from app.ingestion.connectors.static_html_connector import StaticHTMLConnector

        return StaticHTMLConnector().fetch(source, since=since)

    # ------------------------------------------------------------------
    def _fetch_single_pdf(self, pdf_url: str, source_page_url: str | None) -> list[FetchedPage]:
        try:
            pdf_bytes = download_pdf(pdf_url)
        except Exception as exc:
            logger.warning(
                "pdf_download_failed",
                extra={"url": pdf_url, "error": str(exc)},
            )
            return []

        try:
            result: PDFExtractionResult = extract_text(pdf_bytes)
        except Exception as exc:
            logger.warning(
                "pdf_extract_failed",
                extra={"url": pdf_url, "error": str(exc)},
            )
            return []

        logger.info(
            "pdf_fetched",
            extra={
                "url": pdf_url,
                "pages": result.page_count,
                "used_ocr": result.used_ocr,
                "chars": len(result.text),
            },
        )

        return [
            FetchedPage(
                url=pdf_url,
                canonical_url=pdf_url,
                title=None,
                raw_text=result.text,
                content_type=result.content_type,
                document_url=pdf_url,
                source_page_url=source_page_url,
                ocr_used=result.used_ocr,
                metadata={
                    "content_type": "application/pdf",
                    "page_count": result.page_count,
                    "used_ocr": result.used_ocr,
                },
            )
        ]
