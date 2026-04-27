"""
Generic Scholarship Connector.
Wraps StaticHTMLConnector with scholarship-biased discovery scoring.

Source config expected:
  connector_key = generic_scholarship
  source_type   = scholarship
  ingestion_mode = html | rss
"""
from __future__ import annotations

from datetime import datetime

from app.ingestion.connectors.static_html_connector import StaticHTMLConnector, CandidateLink, RELEVANT_TERMS
from app.ingestion.schemas import FetchedPage
from app.models.entities import Source

_SCHOLARSHIP_TERMS = {
    "scholarship": 10,
    "scholarships": 10,
    "fellowship": 8,
    "bursary": 8,
    "grant": 6,
    "tuition": 6,
    "stipend": 6,
    "study abroad": 7,
    "fully funded": 7,
    "undergraduate": 5,
    "postgraduate": 5,
    "phd": 5,
    "master": 4,
    "application deadline": 5,
    "eligibility": 4,
}

_MERGED_TERMS = {**RELEVANT_TERMS, **_SCHOLARSHIP_TERMS}


class GenericScholarshipConnector(StaticHTMLConnector):
    """
    Identical to StaticHTMLConnector except relevance scoring is biased
    toward scholarship-related vocabulary.
    """

    def discover_items(self, source: Source, crawl_mode: str = "active_only") -> list[FetchedPage]:
        return self.fetch(source, since=None)

    def fetch(self, source: Source, since: datetime | None = None) -> list[FetchedPage]:
        # Monkey-patch the module-level RELEVANT_TERMS dict temporarily
        # (safe because Celery tasks are single-threaded per worker)
        import app.ingestion.connectors.static_html_connector as _mod
        original = _mod.RELEVANT_TERMS.copy()
        _mod.RELEVANT_TERMS.update(_SCHOLARSHIP_TERMS)
        try:
            return super().fetch(source, since)
        finally:
            _mod.RELEVANT_TERMS.clear()
            _mod.RELEVANT_TERMS.update(original)
