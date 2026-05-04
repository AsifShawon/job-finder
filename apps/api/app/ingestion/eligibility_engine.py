"""
Derives eligibility metadata from extraction output and source metadata.
All heuristics are intentionally conservative — when uncertain, leave fields None.

Outputs both eligibility flags AND an eligibility_status summary:
  eligible              — clearly open to BD applicants (BOESL, BD keywords)
  conditional           — may be applicable; further verification recommended
  authorized_workers_only — requires existing work permit / citizenship
  unclear_manual_review — confidence too low; must go to admin review
  not_relevant          — no evidence this is applicable to BD workers
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


_BD_OPEN_KEYWORDS = [
    "bangladeshi", "bangladesh nationals", "bd worker", "bd applicant",
    "open to bangladeshi", "bangladeshis can apply", "eligible: bangladesh",
]
_WORK_PERMIT_REQUIRED_KEYWORDS = [
    "valid work permit", "existing work permit", "must hold a work permit",
    "requires work authorization", "authorized to work",
]
_LMIA_REQUESTED_KEYWORDS = ["lmia", "labour market impact assessment", "job offer with lmia"]
_LMIA_APPROVED_KEYWORDS = ["lmia approved", "lmia-approved", "lmia exempt", "lmia exemption"]
_INTERNATIONAL_OPEN_KEYWORDS = [
    "open to international", "international candidates welcome", "global applicants",
    "worldwide applications", "all nationalities", "foreign candidates",
]
_AUTHORIZED_ONLY_KEYWORDS = [
    "authorized workers only", "must be authorized", "must have legal right to work",
    "no sponsorship", "cannot sponsor", "will not sponsor", "citizen", "permanent resident",
    "valid work permit required",
]
_STUDENTS = ["student", "students", "undergraduate", "graduate student", "postgraduate"]
_SCHOLARSHIP_MARKERS = ["scholarship", "fellowship", "bursary", "tuition waiver", "stipend"]
_FRAUD_SIGNALS = [
    "advance fee", "send money", "transfer fee", "registration fee required",
    "pay to apply", "money transfer", "western union",
]
_SKILLED_SIGNALS = ["engineer", "doctor", "nurse", "it specialist", "degree required", "bachelor"]
_LOW_SKILLED_SIGNALS = ["no experience", "freshers", "domestic worker", "cleaner", "labour"]

_BD_BOESL_SOURCES = {"boesl_brms", "boesl_reports_pdf"}
_BD_GOV_SOURCES = {"boesl_brms", "boesl_reports_pdf", "bmet_connector", "oep_connector"}


@dataclass
class EligibilityResult:
    can_apply_from_bd: bool | None = None
    requires_existing_work_permit: bool | None = None
    open_to_international_candidates: bool | None = None
    open_to_authorized_workers_only: bool | None = None
    lmia_status: str = "none"
    eligibility_status: str = "unclear_manual_review"
    target_audience_tags: list[str] = field(default_factory=list)
    risk_flags: list[str] = field(default_factory=list)
    opportunity_type: str | None = None
    source_trust_badge: str | None = None


def _lower(text: str | None) -> str:
    return (text or "").lower()


def _any_keyword(text: str, keywords: list[str]) -> bool:
    return any(kw in text for kw in keywords)


def tag_eligibility(
    *,
    source_connector_key: str | None = None,
    source_trust_level: str | None = None,
    record_type: str = "job",
    country: str | None = None,
    eligibility_text: str | None = None,
    requirements_json: dict[str, Any] | None = None,
    extracted_json: dict[str, Any] | None = None,
    title: str | None = None,
    summary: str | None = None,
    employer: str | None = None,
) -> EligibilityResult:
    result = EligibilityResult()
    extracted_can_apply = None
    if extracted_json and "can_apply_from_bd" in extracted_json:
        extracted_can_apply = extracted_json.get("can_apply_from_bd")
    blob = " ".join(filter(None, [
        _lower(eligibility_text),
        _lower(title),
        _lower(summary),
        _lower(employer),
        " ".join(_lower(r) for r in (requirements_json or {}).get("items", [])),
    ]))

    # ── BOESL/BMET/OEP: always BD-eligible ───────────────────────────────────
    if source_connector_key in _BD_GOV_SOURCES:
        result.can_apply_from_bd = True
        result.source_trust_badge = "সরকারি উৎস"
        result.lmia_status = "none"
        if "bangladeshi_applicants" not in result.target_audience_tags:
            result.target_audience_tags.append("bangladeshi_applicants")

    # ── Explicit BD open keywords ─────────────────────────────────────────────
    if result.can_apply_from_bd is None:
        if extracted_can_apply is not None:
            result.can_apply_from_bd = bool(extracted_can_apply)
        elif _any_keyword(blob, _BD_OPEN_KEYWORDS):
            result.can_apply_from_bd = True

    # ── Work permit required ──────────────────────────────────────────────────
    if _any_keyword(blob, _WORK_PERMIT_REQUIRED_KEYWORDS):
        result.requires_existing_work_permit = True

    # ── Authorized workers only ───────────────────────────────────────────────
    if _any_keyword(blob, _AUTHORIZED_ONLY_KEYWORDS):
        result.open_to_authorized_workers_only = True
        if "authorized_workers_only" not in result.target_audience_tags:
            result.target_audience_tags.append("authorized_workers_only")
        if result.open_to_international_candidates is None:
            result.open_to_international_candidates = False

    # ── Open to international ─────────────────────────────────────────────────
    if _any_keyword(blob, _INTERNATIONAL_OPEN_KEYWORDS):
        result.open_to_international_candidates = True
        if "international_candidates" not in result.target_audience_tags:
            result.target_audience_tags.append("international_candidates")

    # ── LMIA ──────────────────────────────────────────────────────────────────
    if _any_keyword(blob, _LMIA_APPROVED_KEYWORDS):
        result.lmia_status = "approved"
    elif _any_keyword(blob, _LMIA_REQUESTED_KEYWORDS):
        result.lmia_status = "requested"

    # ── Scholarship / student audience ────────────────────────────────────────
    if record_type == "scholarship" or _any_keyword(blob, _SCHOLARSHIP_MARKERS):
        if "scholarship_seekers" not in result.target_audience_tags:
            result.target_audience_tags.append("scholarship_seekers")
        if _any_keyword(blob, _STUDENTS) and "students" not in result.target_audience_tags:
            result.target_audience_tags.append("students")

    # ── Skilled / low-skilled ─────────────────────────────────────────────────
    if _any_keyword(blob, _SKILLED_SIGNALS) and "skilled_workers" not in result.target_audience_tags:
        result.target_audience_tags.append("skilled_workers")
    if _any_keyword(blob, _LOW_SKILLED_SIGNALS) and "low_skilled_workers" not in result.target_audience_tags:
        result.target_audience_tags.append("low_skilled_workers")

    # ── Opportunity type inference ────────────────────────────────────────────
    if record_type == "scholarship":
        result.opportunity_type = "scholarship"
    elif record_type == "policy_update":
        result.opportunity_type = "visa_update" if _any_keyword(blob, ["visa"]) else "migration_policy"
    elif record_type == "job":
        dest = _lower(country)
        result.opportunity_type = "overseas_job" if (dest and dest != "bangladesh") else "local_job"

    # ── Trust badge from source level ─────────────────────────────────────────
    if result.source_trust_badge is None:
        trust = source_trust_level or ""
        if trust == "government_official":
            result.source_trust_badge = "সরকারি উৎস"
        elif trust == "official_partner":
            result.source_trust_badge = "অফিসিয়াল পার্টনার"
        elif trust == "verified_source":
            result.source_trust_badge = "যাচাইকৃত উৎস"

    # ── Risk flags ────────────────────────────────────────────────────────────
    if _any_keyword(blob, _FRAUD_SIGNALS):
        result.risk_flags.append("possible_fraud")

    # ── Determine eligibility_status ──────────────────────────────────────────
    if result.open_to_authorized_workers_only and not result.open_to_international_candidates:
        result.eligibility_status = "authorized_workers_only"
    elif result.can_apply_from_bd is True:
        result.eligibility_status = "eligible"
    elif result.open_to_international_candidates is True:
        result.eligibility_status = "conditional"
    elif result.can_apply_from_bd is False:
        result.eligibility_status = "not_relevant"
    else:
        result.eligibility_status = "unclear_manual_review"

    result.target_audience_tags = list(dict.fromkeys(result.target_audience_tags))
    return result
