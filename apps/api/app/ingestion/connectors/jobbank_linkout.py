"""
Job Bank (Canada) linkout connector.

Job Bank's terms prohibit deep scraping. This connector creates a source-level
linkout card pointing users to the official Job Bank search page.

Compliance: linkout_only — do NOT fetch individual job pages.
Set compliance_status='linkout_only', connector_key='jobbank_linkout'.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.ingestion.connectors.base import BaseConnector
from app.ingestion.schemas import FetchedPage

if TYPE_CHECKING:
    from app.models.entities import Source

logger = logging.getLogger(__name__)

_JOBBANK_SEARCH_URL = "https://www.jobbank.gc.ca/jobsearch/jobsearch"


class JobBankLinkoutConnector(BaseConnector):
    """
    Creates a single linkout card for Job Bank Canada.
    Does NOT scrape any individual job listing pages.
    Users are directed to search Job Bank directly.
    """

    def discover_items(self, source: "Source", crawl_mode: str | None = None) -> list[FetchedPage]:
        keywords = source.search_keywords or source.search_queries or []
        search_url = _JOBBANK_SEARCH_URL
        if keywords:
            from urllib.parse import urlencode
            search_url += "?" + urlencode({"searchstring": " ".join(keywords)})

        page = FetchedPage(
            url=search_url,
            source_page_url=search_url,
            title="Job Bank Canada — Official Job Search",
            raw_text=(
                "Job Bank is Canada's official federal job portal. "
                "Bangladeshi workers with valid work permits can search for jobs in Canada. "
                "LMIA-approved positions and IMP streams are listed here. "
                "Visit the official website to browse and apply."
            ),
            content_type="linkout_only",
            metadata={
                "source": "jobbank_canada",
                "country": "Canada",
                "open_to_international": True,
                "opportunity_type_hint": "overseas_job",
                "linkout_only": True,
                "lmia_relevant": True,
            },
        )
        logger.info("jobbank_linkout_created", extra={"source_id": source.id})
        return [page]
