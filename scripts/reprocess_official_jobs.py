"""Reprocess official job records that have bad summaries or missing rich fields.

Usage:
    python scripts/reprocess_official_jobs.py --dry-run
    python scripts/reprocess_official_jobs.py --apply
    python scripts/reprocess_official_jobs.py --apply --source tamimi_careers
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

# Add the api app to sys.path so app.* imports work
sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "api"))

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.ingestion.extractor import extract_official_job_structured
from app.ingestion.pipeline import _is_raw_metadata_text, _official_ai_cleaned_payload
from app.ingestion.schemas import FetchedPage
from app.models.entities import Opportunity, RawDocument, Source

OFFICIAL_CONNECTOR_KEYS = {
    "tamimi_careers",
    "successfactors_alfanar",
    "successfactors_aramco",
    "maharah_posts",
}

_RAW_METADATA_SIGNALS = (
    "Official listing metadata:",
    "Job detail page content:",
    "Source job ID:",
    "Apply URL:",
)


def _needs_reprocess(opp: Opportunity) -> str | None:
    """Return a reason string if the record needs reprocessing, else None."""
    for field in ("summary_en", "summary_bn"):
        val = getattr(opp, field, None)
        if val and any(sig in val[:400] for sig in _RAW_METADATA_SIGNALS):
            return f"raw_metadata_in_{field}"
    extracted = opp.extracted_json or {}
    missing_rich = not (
        extracted.get("source_sections")
        or extracted.get("responsibilities")
        or extracted.get("qualifications")
    )
    if missing_rich:
        return "missing_rich_fields"
    return None


def _build_fake_page(raw: RawDocument) -> FetchedPage:
    """Reconstruct a minimal FetchedPage from a RawDocument for re-extraction."""
    metadata = raw.metadata_json or {}
    return FetchedPage(
        url=raw.source_url or "",
        canonical_url=raw.canonical_url or raw.source_url or "",
        title=raw.raw_title or "",
        raw_html=raw.raw_html_snapshot or "",
        raw_text=raw.raw_text or "",
        metadata=metadata,
        content_type=raw.content_type or "html",
        original_apply_url=metadata.get("apply_url"),
    )


def reprocess(
    db: Session,
    connector_key_filter: str | None,
    dry_run: bool,
) -> None:
    query = select(Opportunity).where(
        Opportunity.connector_key.in_(OFFICIAL_CONNECTOR_KEYS),
        Opportunity.status.in_(["published", "pending"]),
    )
    if connector_key_filter:
        query = query.where(Opportunity.connector_key == connector_key_filter)

    opportunities = db.scalars(query).all()

    total = len(opportunities)
    needs_fix: list[tuple[Opportunity, str]] = []
    for opp in opportunities:
        reason = _needs_reprocess(opp)
        if reason:
            needs_fix.append((opp, reason))

    print(f"Total official opportunities: {total}")
    print(f"Needing reprocess: {len(needs_fix)}")
    print()

    if not needs_fix:
        print("Nothing to do.")
        return

    if dry_run:
        print("DRY RUN — no changes written.\n")
        for opp, reason in needs_fix:
            print(f"  [{opp.connector_key}] #{opp.id} {opp.title!r} — {reason}")
        return

    fixed = 0
    errors = 0
    for opp, reason in needs_fix:
        try:
            raw: RawDocument | None = None
            if opp.raw_document_id:
                raw = db.get(RawDocument, opp.raw_document_id)
            if raw is None:
                print(f"  SKIP #{opp.id}: no raw_document linked")
                continue

            source: Source | None = db.get(Source, opp.source_id)
            if source is None:
                print(f"  SKIP #{opp.id}: source not found")
                continue

            page = _build_fake_page(raw)
            cleaned: dict[str, Any] = {
                "title": raw.raw_title or opp.title,
                "body_text": raw.raw_text or "",
                "apply_link": page.original_apply_url,
            }
            augmented = _official_ai_cleaned_payload(source, page, cleaned)

            extraction = extract_official_job_structured(db, augmented)

            if extraction.record_type == "unknown":
                print(f"  SKIP #{opp.id}: re-extraction returned unknown")
                continue

            # Apply rich fields back to the opportunity
            extracted_dict = extraction.model_dump(mode="json")

            if extraction.summary_en and not _is_raw_metadata_text(extraction.summary_en):
                opp.summary_en = extraction.summary_en
            if extraction.summary_bn and not _is_raw_metadata_text(extraction.summary_bn):
                opp.summary_bn = extraction.summary_bn
            if extraction.summary and not _is_raw_metadata_text(extraction.summary):
                opp.summary = extraction.summary

            # Merge rich extracted fields into extracted_json
            existing_json: dict = opp.extracted_json or {}
            for field in (
                "source_sections", "responsibilities", "qualifications",
                "key_accountabilities", "role_accountabilities", "skills",
                "work_conditions", "job_purpose",
            ):
                val = extracted_dict.get(field)
                if val:
                    existing_json[field] = val
            existing_json["reprocess_extraction_method"] = extraction.extraction_method
            opp.extracted_json = existing_json

            if extraction.extraction_confidence:
                opp.extraction_confidence = extraction.extraction_confidence

            # Refresh PostgreSQL full-text search vector
            try:
                from sqlalchemy import text as _text
                db.execute(
                    _text(
                        "UPDATE opportunities SET search_tsv = to_tsvector('english', "
                        "coalesce(title,'') || ' ' || coalesce(summary_en,'') || ' ' || coalesce(employer_or_organization,'')) "
                        "WHERE id = :oid"
                    ),
                    {"oid": opp.id},
                )
            except Exception:
                pass

            db.commit()
            print(f"  FIXED #{opp.id} [{opp.connector_key}] {opp.title!r} (method={extraction.extraction_method})")
            fixed += 1

        except Exception as exc:
            db.rollback()
            print(f"  ERROR #{opp.id}: {exc}")
            errors += 1

    print()
    print(f"Done — fixed: {fixed}, errors: {errors}, skipped: {len(needs_fix) - fixed - errors}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Reprocess official job records with bad summaries.")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be fixed without writing changes.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    parser.add_argument("--source", default=None, help="Filter by connector_key (e.g. tamimi_careers).")
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        print("Specify --dry-run or --apply.")
        sys.exit(1)

    with SessionLocal() as db:
        reprocess(db, connector_key_filter=args.source, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
