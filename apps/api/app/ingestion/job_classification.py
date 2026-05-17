from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.services.isc_taxonomy import count_isc_term_hits, determine_isc_category_key


TARGET_TITLE_TERMS = {
    "electrician", "electrical technician", "technician", "mechanic", "driver",
    "worker", "helper", "cleaner", "waiter", "nurse", "caregiver", "foreman",
    "operator", "carpenter", "plumber", "welder", "farm worker", "factory worker",
    "hotel worker", "restaurant worker", "delivery", "maintenance", "warehouse",
    "tailor", "garment", "construction", "rigger", "scaffold", "fitter",
}

HIGH_SKILL_TERMS = {
    "bachelor", "master", "phd", "doctorate", "engineer", "senior manager",
    "manager", "specialist", "consultant", "advisor", "counsel", "strategist",
    "scientist", "research", "architect", "lead ",
}

TRANSFERABLE_IQAMA_TERMS = {"transferable iqama", "valid iqama", "iqama transferable"}

INFORMATIONAL_TERMS = {
    "blog", "article", "guide", "tips", "news", "what is", "how to", "all posts",
}


@dataclass
class CategoryResult:
    isc_category_key: str | None
    platform_category_bn: str | None
    platform_category_en: str | None
    occupation_family: str | None
    category_match_score: float


@dataclass
class SuitabilityResult:
    bangladesh_applicability: str
    bangladesh_applicability_reason: str
    rural_user_fit_score: float
    bangladesh_applicability_score: float
    actionability_score: float
    needs_review: bool
    warnings: list[str] = field(default_factory=list)


_CATEGORY_RULES: list[tuple[str, str, str, list[str]]] = [
    ("লাইট ইঞ্জিনিয়ারিং", "Light Engineering", "electrical_maintenance", ["electrician", "electrical", "maintenance technician", "mechanic", "fitter"]),
    ("কনস্ট্রাকশন", "Construction", "construction", ["civil", "foreman", "construction", "scaffold", "rigger", "surveyor", "mason", "plumber", "carpenter", "welder"]),
    ("এগ্রিকালচার", "Agriculture", "agriculture", ["farm", "agriculture", "livestock", "poultry"]),
    ("ট্যুরিজম ও হসপিটালিটি", "Tourism and Hospitality", "hospitality", ["waiter", "buffet", "hotel", "restaurant", "hospitality", "cook", "chef"]),
    ("রেডিমেড গার্মেন্টস ও টেক্সটাইল", "Ready-made Garments and Textile", "garments_textile", ["tailor", "garment", "textile", "sewing"]),
    ("ইনফরমাল সেক্টর", "Informal Sector", "general_worker", ["driver", "delivery", "cleaner", "helper", "worker", "warehouse", "factory", "domestic", "caregiver", "nurse"]),
    ("আইসিটি", "ICT", "ict", ["software", "developer", "sap", "it ", "data", "cyber", "network"]),
]


def classify_category(*, title: str | None, body: str | None, sector: str | None = None) -> CategoryResult:
    text = _norm(" ".join(filter(None, [title, body, sector])))
    best: tuple[str, str, str, int] | None = None
    for bn, en, family, keywords in _CATEGORY_RULES:
        hits = sum(1 for keyword in keywords if keyword in text)
        if hits and (best is None or hits > best[3]):
            best = (bn, en, family, hits)
    isc_category_key = determine_isc_category_key(title, body, sector)
    if best is None:
        if isc_category_key is None:
            return CategoryResult(None, None, None, None, 0.0)
        hit_count = count_isc_term_hits(title, body, sector, category_key=isc_category_key)
        score = min(1.0, 0.45 + (hit_count * 0.2)) if hit_count else 0.45
        return CategoryResult(isc_category_key, None, None, None, score)
    score = min(1.0, 0.45 + (best[3] * 0.2))
    return CategoryResult(isc_category_key, best[0], best[1], best[2], score)


def classify_bangladesh_suitability(
    *,
    title: str | None,
    body: str | None,
    apply_url: str | None,
    source_trust_level: str | None,
    source_connector_key: str | None,
    extraction_confidence: float,
    detected_item_type: str | None = None,
) -> SuitabilityResult:
    text = _norm(" ".join(filter(None, [title, body])))
    warnings: list[str] = []

    is_info = detected_item_type == "occupation_intelligence" or any(term in text[:500] for term in INFORMATIONAL_TERMS)
    target_hits = sum(1 for term in TARGET_TITLE_TERMS if term in text)
    high_skill_hits = sum(1 for term in HIGH_SKILL_TERMS if term in text)
    years = _max_experience_years(text)

    rural_fit = 0.25
    if target_hits:
        rural_fit += min(0.45, target_hits * 0.08)
    if high_skill_hits:
        rural_fit -= min(0.35, high_skill_hits * 0.08)
    if years and years > 8:
        rural_fit -= 0.25
    if years is not None and years <= 3:
        rural_fit += 0.1
    rural_fit = _clamp(rural_fit)

    actionability = 0.3 + (0.45 if apply_url else 0.0)
    if "requirement" in text or "qualification" in text or "experience" in text:
        actionability += 0.15
    if "deadline" in text or "closing date" in text:
        actionability += 0.1
    actionability = _clamp(actionability)

    if not apply_url:
        warnings.append("missing_apply_link")
    if any(term in text for term in TRANSFERABLE_IQAMA_TERMS):
        warnings.append("transferable_iqama")
    if extraction_confidence < 0.55:
        warnings.append("low_ai_confidence")
    if "salary" not in text and "sar" not in text:
        warnings.append("missing_salary")
    if "deadline" not in text and "closing date" not in text:
        warnings.append("missing_deadline")
    if is_info:
        warnings.append("possible_blog_post")

    trust_bonus = 0.15 if source_trust_level in {"official_partner", "government_official", "verified_source"} else 0.0
    applicability_score = _clamp((0.25 if apply_url else 0.05) + (0.25 if target_hits else 0.0) + trust_bonus - (0.25 if "transferable_iqama" in warnings else 0.0))

    if is_info and not apply_url:
        applicability = "reject"
        reason = "Informational post without a clear application path."
        needs_review = False
    elif target_hits and apply_url and rural_fit >= 0.55 and "transferable_iqama" not in warnings:
        applicability = "high"
        reason = "Worker-oriented role with clear application path from an official source."
        needs_review = extraction_confidence < 0.65
    elif target_hits and apply_url:
        applicability = "medium"
        reason = "Relevant role, but some eligibility or requirement details need checking."
        needs_review = True
    elif high_skill_hits or (source_connector_key == "successfactors_aramco"):
        applicability = "low"
        reason = "Likely high-skilled or not clearly targeted to Bangladeshi rural/semi-skilled applicants."
        needs_review = True
    else:
        applicability = "low"
        reason = "No strong evidence that this is suitable for the target Bangladeshi worker audience."
        needs_review = True

    return SuitabilityResult(
        bangladesh_applicability=applicability,
        bangladesh_applicability_reason=reason,
        rural_user_fit_score=rural_fit,
        bangladesh_applicability_score=applicability_score,
        actionability_score=actionability,
        needs_review=needs_review,
        warnings=list(dict.fromkeys(warnings)),
    )


def is_relevant_for_active_job(*, title: str | None, body: str | None, apply_url: str | None, detected_item_type: str | None) -> tuple[bool, str | None]:
    text = _norm(" ".join(filter(None, [title, body])))
    if detected_item_type == "occupation_intelligence" and not apply_url:
        return False, "occupation_intelligence_without_apply_path"
    if any(term in text[:700] for term in INFORMATIONAL_TERMS) and not apply_url:
        return False, "informational_post_without_apply_path"
    if not (title or body):
        return False, "missing_title_and_body"
    return True, None


def _max_experience_years(text: str) -> int | None:
    values = [int(match.group(1)) for match in re.finditer(r"(\d{1,2})\+?\s*(?:years?|yrs?)", text)]
    return max(values) if values else None


def _norm(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").lower()).strip()


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))
