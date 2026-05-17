from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from app.ingestion.official_job_sections import (
    OfficialJobFieldEvidence,
    OfficialJobParsedPayload,
    OfficialJobSection,
)

_NOISE_PATTERNS = (
    r"^accept$",
    r"^close$",
    r"^login$",
    r"^log in$",
    r"^sign in$",
    r"^view profile$",
    r"^my profile$",
    r"^start apply with linkedin$",
    r"^apply now$",
    r"^please wait\.?$",
    r"^all openings$",
    r"^search jobs$",
    r"^share this job$",
    r"^share$",
    r"^navigation menu$",
    r"^cookie(s)?$",
    r"^privacy policy$",
    r"^careers home$",
    r"^job alerts$",
    r"^create alert$",
    r"^already applied$",
)
_PUNCT_ONLY_RE = re.compile(r"^[\W_]+$")
_DATE_PATTERNS = (
    r"\b\d{1,2}\s+[A-Z][a-z]{2,8}\s+20\d{2}\b",
    r"\b\d{1,2}/\d{1,2}/\d{2,4}\b",
    r"\b20\d{2}-\d{1,2}-\d{1,2}\b",
)
_WORK_PERMIT_RE = re.compile(
    r"\b(iqama|transferable iqama|work permit|visa|sponsorship|authorization|residency)\b",
    re.I,
)
_SALARY_RE = re.compile(r"\b(salary|wage|compensation|pay|allowance)\b", re.I)
_DEADLINE_RE = re.compile(r"\b(deadline|closing date|last date|apply before)\b", re.I)


@dataclass(frozen=True)
class _RuleSet:
    heading_map: dict[str, str]
    responsibility_sections: tuple[str, ...] = ()
    qualification_sections: tuple[str, ...] = ()
    skill_sections: tuple[str, ...] = ()
    benefit_sections: tuple[str, ...] = ()


_RULES: dict[str, _RuleSet] = {
    "successfactors_alfanar": _RuleSet(
        heading_map={
            "job purpose": "job_purpose",
            "overview": "job_purpose",
            "key accountability areas": "key_accountabilities",
            "project execution": "responsibilities",
            "coordination": "responsibilities",
            "quality and safety": "responsibilities",
            "documentation and reporting": "responsibilities",
            "problem solving": "responsibilities",
            "technical skills": "technical_skills",
            "role accountability": "role_accountabilities",
            "academic qualification": "education",
            "work experience": "work_experience",
            "technical or functional competencies": "competencies",
            "technical/functional competencies": "competencies",
        },
        responsibility_sections=(
            "key_accountabilities",
            "responsibilities",
            "role_accountabilities",
        ),
        qualification_sections=("education", "work_experience", "competencies"),
        skill_sections=("technical_skills", "competencies"),
    ),
    "successfactors_aramco": _RuleSet(
        heading_map={
            "overview": "job_purpose",
            "job purpose": "job_purpose",
            "responsibilities": "responsibilities",
            "minimum requirements": "qualifications",
            "working environment": "benefits",
            "education": "education",
            "experience": "work_experience",
            "certificates": "qualifications",
            "skills": "technical_skills",
        },
        responsibility_sections=("responsibilities",),
        qualification_sections=("qualifications", "education", "work_experience"),
        skill_sections=("technical_skills",),
        benefit_sections=("benefits",),
    ),
    "tamimi_careers": _RuleSet(
        heading_map={
            "job description": "job_purpose",
            "description": "job_purpose",
            "department": "department",
            "location": "location",
            "job posted on": "posted_date_text",
            "posted on": "posted_date_text",
            "experience required": "work_experience",
            "qualifications": "qualifications",
            "transferable iqama": "work_permit_or_iqama",
            "requirements": "qualifications",
        },
        responsibility_sections=("job_purpose",),
        qualification_sections=("qualifications", "work_experience", "work_permit_or_iqama"),
    ),
    "maharah_posts": _RuleSet(
        heading_map={
            "job title": "title",
            "location": "location",
            "description": "job_purpose",
            "requirements": "qualifications",
            "responsibilities": "responsibilities",
            "skills": "technical_skills",
            "benefits": "benefits",
            "apply link": "apply_url",
        },
        responsibility_sections=("responsibilities",),
        qualification_sections=("qualifications",),
        skill_sections=("technical_skills",),
        benefit_sections=("benefits",),
    ),
}


def parse_official_job_detail(
    html: str,
    raw_text: str,
    metadata: dict,
    connector_key: str,
    url: str,
) -> OfficialJobParsedPayload:
    rules = _RULES.get(connector_key, _RULES["maharah_posts"])
    soup = BeautifulSoup(html or "", "html.parser")
    _remove_noise_nodes(soup)
    title = _extract_title(soup, metadata)
    clean_lines, ignored_noise_lines = _extract_clean_lines(soup, raw_text)
    sections = _build_sections(clean_lines, rules)
    field_sources: dict[str, list[OfficialJobFieldEvidence]] = defaultdict(list)
    payload = OfficialJobParsedPayload(
        source_url=str(metadata.get("requested_detail_url") or metadata.get("listing_page_url") or url),
        final_url=str(metadata.get("final_rendered_url") or url),
        connector_key=connector_key,
        company=_clean(metadata.get("company")),
        title=title,
        requisition_id=_clean(metadata.get("source_job_id")) or _extract_requisition_id("\n".join(clean_lines)),
        country=_extract_country(clean_lines, metadata),
        city=_extract_city(clean_lines, metadata),
        department=_extract_department(sections, metadata),
        posted_date_text=_extract_posted_date(sections, clean_lines, metadata),
        apply_url=_extract_apply_url(soup, url, metadata),
        raw_sections=sections,
        ignored_noise_lines=ignored_noise_lines,
        parser_warnings=[],
        parser_confidence=0.0,
        field_sources={},
    )
    _fill_payload_from_sections(payload, sections, rules, field_sources)
    _fill_payload_from_lines(payload, clean_lines, field_sources)
    payload.field_sources = {key: value for key, value in field_sources.items() if value}
    payload.parser_confidence = _compute_confidence(payload)
    if not payload.title:
        payload.parser_warnings.append("missing_title")
    if not payload.apply_url:
        payload.parser_warnings.append("missing_apply_url")
    if not payload.country:
        payload.parser_warnings.append("missing_country")
    return payload


def _remove_noise_nodes(soup: BeautifulSoup) -> None:
    for selector in (
        "script",
        "style",
        "noscript",
        "svg",
        "nav",
        "header",
        "footer",
        "[id*='cookie' i]",
        "[class*='cookie' i]",
        "[id*='onetrust' i]",
        "[class*='onetrust' i]",
        "[class*='profile' i]",
        "[id*='profile' i]",
        "[class*='share' i]",
        "[class*='alert' i]",
        "[aria-label*='close' i]",
    ):
        for node in soup.select(selector):
            node.decompose()


def _extract_title(soup: BeautifulSoup, metadata: dict) -> str | None:
    for node in (
        soup.select_one("h1"),
        soup.select_one("[data-automation-id='jobPostingHeader']"),
        soup.select_one("title"),
    ):
        if node:
            text_value = _clean(node.get_text(" ", strip=True))
            if text_value and text_value.lower() not in {"career details", "job details"}:
                return text_value
    return _clean(metadata.get("listing_card_title")) or _clean(metadata.get("title"))


def _extract_clean_lines(soup: BeautifulSoup, raw_text: str) -> tuple[list[str], list[str]]:
    text_value = soup.get_text("\n", strip=True) if soup else raw_text
    if raw_text and len(raw_text) > len(text_value):
        text_value = raw_text
    lines: list[str] = []
    ignored: list[str] = []
    seen: set[str] = set()
    for raw_line in text_value.splitlines():
        line = _clean(raw_line)
        if not line:
            continue
        lowered = line.lower()
        if lowered in seen:
            ignored.append(line)
            continue
        if _is_noise_line(line):
            ignored.append(line)
            continue
        seen.add(lowered)
        lines.append(line)
    return lines, ignored


def _build_sections(lines: list[str], rules: _RuleSet) -> list[OfficialJobSection]:
    sections: list[OfficialJobSection] = []
    current_heading = "General"
    current_normalized = "general"
    bucket: list[str] = []

    def flush() -> None:
        nonlocal bucket, current_heading, current_normalized
        if not bucket:
            return
        sections.append(
            OfficialJobSection(
                heading=current_heading,
                normalized_heading=current_normalized,
                items=_normalize_items(bucket),
                raw_text="\n".join(bucket),
                confidence=0.8 if current_normalized != "general" else 0.45,
            )
        )
        bucket = []

    for line in lines:
        heading = _match_heading(line, rules.heading_map)
        if heading is not None:
            flush()
            current_heading = line
            current_normalized = heading
            continue
        bucket.append(line)
    flush()
    return sections


def _fill_payload_from_sections(
    payload: OfficialJobParsedPayload,
    sections: list[OfficialJobSection],
    rules: _RuleSet,
    field_sources: dict[str, list[OfficialJobFieldEvidence]],
) -> None:
    for section in sections:
        normalized = section.normalized_heading
        if normalized == "job_purpose" and not payload.job_purpose:
            payload.job_purpose = _join_items(section.items)
            _record_field_source(field_sources, "job_purpose", section.heading, section.items[:1])
        elif normalized == "key_accountabilities":
            _merge_items(payload.key_accountabilities, section.items)
            _record_field_source(field_sources, "key_accountabilities", section.heading, section.items)
        elif normalized == "role_accountabilities":
            _merge_items(payload.role_accountabilities, section.items)
            _record_field_source(field_sources, "role_accountabilities", section.heading, section.items)
        elif normalized == "responsibilities":
            _merge_items(payload.responsibilities, section.items)
            _record_field_source(field_sources, "responsibilities", section.heading, section.items)
        elif normalized == "qualifications":
            _merge_items(payload.qualifications, section.items)
            _record_field_source(field_sources, "qualifications", section.heading, section.items)
        elif normalized == "technical_skills":
            _merge_items(payload.technical_skills, section.items)
            _record_field_source(field_sources, "technical_skills", section.heading, section.items)
        elif normalized == "competencies":
            _merge_items(payload.competencies, section.items)
            _record_field_source(field_sources, "competencies", section.heading, section.items)
        elif normalized == "benefits":
            _merge_items(payload.benefits, section.items)
            _record_field_source(field_sources, "benefits", section.heading, section.items)
        elif normalized == "education" and not payload.education:
            payload.education = _join_items(section.items)
            _merge_items(payload.qualifications, section.items)
            _record_field_source(field_sources, "education", section.heading, section.items[:1])
        elif normalized == "work_experience" and not payload.work_experience:
            payload.work_experience = _join_items(section.items)
            _merge_items(payload.qualifications, section.items)
            _record_field_source(field_sources, "work_experience", section.heading, section.items[:1])
        elif normalized == "work_permit_or_iqama" and not payload.work_permit_or_iqama:
            payload.work_permit_or_iqama = _join_items(section.items)
            _record_field_source(field_sources, "work_permit_or_iqama", section.heading, section.items[:1])
        elif normalized == "posted_date_text" and not payload.posted_date_text:
            payload.posted_date_text = _join_items(section.items)
            _record_field_source(field_sources, "posted_date_text", section.heading, section.items[:1])
        elif normalized == "department" and not payload.department:
            payload.department = _join_items(section.items)
            _record_field_source(field_sources, "department", section.heading, section.items[:1])
        elif normalized == "apply_url" and not payload.apply_url:
            payload.apply_url = _first_url(section.items)
            _record_field_source(field_sources, "apply_url", section.heading, section.items[:1])
        elif normalized == "location":
            if not payload.city:
                payload.city = _extract_city(section.items, {})
            if not payload.country:
                payload.country = _extract_country(section.items, {})
            _record_field_source(field_sources, "location", section.heading, section.items[:1])
        elif normalized == "title" and not payload.title:
            payload.title = _join_items(section.items)
            _record_field_source(field_sources, "title", section.heading, section.items[:1])

    if not payload.responsibilities:
        derived: list[str] = []
        for section in sections:
            if section.normalized_heading in rules.responsibility_sections:
                _merge_items(derived, section.items)
        payload.responsibilities = derived
    if not payload.qualifications:
        derived = []
        for section in sections:
            if section.normalized_heading in rules.qualification_sections:
                _merge_items(derived, section.items)
        payload.qualifications = derived
    if not payload.technical_skills:
        derived = []
        for section in sections:
            if section.normalized_heading in rules.skill_sections:
                _merge_items(derived, section.items)
        payload.technical_skills = derived
    if not payload.benefits:
        derived = []
        for section in sections:
            if section.normalized_heading in rules.benefit_sections:
                _merge_items(derived, section.items)
        payload.benefits = derived


def _fill_payload_from_lines(
    payload: OfficialJobParsedPayload,
    lines: list[str],
    field_sources: dict[str, list[OfficialJobFieldEvidence]],
) -> None:
    for line in lines:
        if not payload.salary_text and _SALARY_RE.search(line):
            payload.salary_text = line
            _record_field_source(field_sources, "salary_text", "Inline metadata", [line])
        if not payload.deadline_text and _DEADLINE_RE.search(line):
            payload.deadline_text = line
            _record_field_source(field_sources, "deadline_text", "Inline metadata", [line])
        if not payload.work_permit_or_iqama and _WORK_PERMIT_RE.search(line):
            payload.work_permit_or_iqama = line
            _record_field_source(field_sources, "work_permit_or_iqama", "Inline metadata", [line])
        if not payload.posted_date_text:
            for pattern in _DATE_PATTERNS:
                match = re.search(pattern, line)
                if match:
                    payload.posted_date_text = match.group(0)
                    _record_field_source(field_sources, "posted_date_text", "Inline metadata", [line])
                    break


def _extract_department(sections: list[OfficialJobSection], metadata: dict) -> str | None:
    for section in sections:
        if section.normalized_heading == "department":
            return _join_items(section.items)
    return _clean(metadata.get("department"))


def _extract_posted_date(
    sections: list[OfficialJobSection],
    lines: list[str],
    metadata: dict,
) -> str | None:
    for section in sections:
        if section.normalized_heading == "posted_date_text":
            return _join_items(section.items)
    date_value = _clean(metadata.get("posting_date_text"))
    if date_value:
        return date_value
    for line in lines:
        for pattern in _DATE_PATTERNS:
            match = re.search(pattern, line)
            if match:
                return match.group(0)
    return None


def _extract_apply_url(soup: BeautifulSoup, url: str, metadata: dict) -> str | None:
    for anchor in soup.select("a[href]"):
        text_value = _clean(anchor.get_text(" ", strip=True)).lower()
        href = (anchor.get("href") or "").strip()
        if not href:
            continue
        if "apply" in text_value or "apply" in href.lower():
            return urljoin(url, href)
    return _clean(metadata.get("apply_url")) or _clean(metadata.get("original_apply_url")) or str(metadata.get("final_rendered_url") or url)


def _extract_country(lines: list[str] | list[str], metadata: dict) -> str | None:
    line_text = "\n".join(lines if isinstance(lines, list) else [str(lines)])
    for candidate in ("Saudi Arabia", "KSA", "Kingdom of Saudi Arabia", "United Arab Emirates", "Jordan"):
        if re.search(rf"\b{re.escape(candidate)}\b", line_text, re.I):
            if candidate == "KSA":
                return "Saudi Arabia"
            if candidate == "Kingdom of Saudi Arabia":
                return "Saudi Arabia"
            return candidate
    return _clean(metadata.get("country_hint")) or _clean(metadata.get("country"))


def _extract_city(lines: list[str] | list[str], metadata: dict) -> str | None:
    line_text = "\n".join(lines if isinstance(lines, list) else [str(lines)])
    for city in ("Riyadh", "Jeddah", "Dammam", "Al Khobar", "Khobar", "Jubail", "Yanbu"):
        if re.search(rf"\b{re.escape(city)}\b", line_text, re.I):
            return city.replace("Khobar", "Al Khobar") if city == "Khobar" else city
    location_raw = _clean(metadata.get("location_raw"))
    if location_raw:
        parts = [part.strip() for part in re.split(r"[,|-]", location_raw) if part.strip()]
        if parts:
            return parts[0]
    return None


def _extract_requisition_id(text_value: str) -> str | None:
    match = re.search(r"\b(?:req(?:uisition)?(?:\s*id)?[:\s-]*)?(\d{4,10})\b", text_value, re.I)
    return match.group(1) if match else None


def _match_heading(line: str, heading_map: dict[str, str]) -> str | None:
    normalized_line = _normalize_heading(line)
    for candidate, mapped in heading_map.items():
        if normalized_line == _normalize_heading(candidate):
            return mapped
    if normalized_line.endswith(":"):
        normalized_line = normalized_line.rstrip(":").strip()
        for candidate, mapped in heading_map.items():
            if normalized_line == _normalize_heading(candidate):
                return mapped
    return None


def _normalize_heading(value: str) -> str:
    cleaned = re.sub(r"[\s:/|]+", " ", value.lower()).strip()
    return re.sub(r"\s+", " ", cleaned)


def _normalize_items(lines: list[str]) -> list[str]:
    items: list[str] = []
    for line in lines:
        for part in re.split(r"\s*[•\u2022]\s*|\s*;\s*", line):
            cleaned = re.sub(r"^\d+[\.\)]\s*", "", part).strip(" -:\t")
            if len(cleaned) < 2:
                continue
            if cleaned not in items:
                items.append(cleaned)
    return items


def _record_field_source(
    field_sources: dict[str, list[OfficialJobFieldEvidence]],
    field_name: str,
    heading: str,
    items: list[str],
) -> None:
    for item in items[:6]:
        if not item:
            continue
        field_sources[field_name].append(
            OfficialJobFieldEvidence(
                field_name=field_name,
                section_heading=heading,
                evidence_line=item,
            )
        )


def _merge_items(target: list[str], items: list[str]) -> None:
    for item in items:
        if item and item not in target:
            target.append(item)


def _join_items(items: list[str]) -> str | None:
    cleaned = [item for item in items if item]
    return "\n".join(cleaned) if cleaned else None


def _first_url(items: list[str]) -> str | None:
    for item in items:
        match = re.search(r"https?://\S+", item)
        if match:
            return match.group(0).rstrip(").,")
    return None


def _compute_confidence(payload: OfficialJobParsedPayload) -> float:
    score = 0.0
    if payload.title:
        score += 0.18
    if payload.company:
        score += 0.12
    if payload.country:
        score += 0.1
    if payload.city:
        score += 0.07
    if payload.apply_url:
        score += 0.15
    if payload.job_purpose:
        score += 0.1
    if payload.responsibilities:
        score += 0.1
    if payload.qualifications or payload.education or payload.work_experience:
        score += 0.1
    if payload.technical_skills or payload.competencies:
        score += 0.08
    return round(min(score, 0.98), 3)


def _is_noise_line(line: str) -> bool:
    lowered = line.lower().strip()
    if not lowered:
        return True
    if _PUNCT_ONLY_RE.match(lowered):
        return True
    return any(re.match(pattern, lowered) for pattern in _NOISE_PATTERNS)


def _clean(value: object | None) -> str | None:
    cleaned = re.sub(r"\s+", " ", str(value or "")).strip()
    return cleaned or None
