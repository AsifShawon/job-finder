"""Bangla-first RAG copilot over the published opportunities corpus."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass

import httpx
from langchain_groq import ChatGroq
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Opportunity, OpportunityEmbedding, SavedOpportunity
from app.services.embedding_service import embed_query
from app.services.runtime_settings_service import (
    get_ai_api_key,
    get_ai_model,
    get_ai_provider,
)

logger = logging.getLogger(__name__)

_TOP_K = 5
_CONTEXT_BUDGET = 4500
_HISTORY_TURN_LIMIT = 6
_HISTORY_BUDGET = 1800


@dataclass
class ConversationTurn:
    role: str
    content: str


@dataclass
class CopilotCitation:
    opportunity_id: int
    title: str
    title_bn: str | None
    title_en: str | None
    opportunity_type: str | None
    country: str | None
    destination_country: str | None
    deadline: str | None
    employer_or_organization: str | None
    salary_min: float | None
    salary_max: float | None
    salary_currency: str | None
    salary_text: str | None
    salary_text_bn: str | None
    can_apply_from_bd: bool | None
    source_trust_badge: str | None
    source_url: str
    is_saved: bool
    summary: str | None
    summary_bn: str | None


@dataclass
class CopilotAnswer:
    answer: str
    locale: str
    citations: list[CopilotCitation]
    suggested_follow_ups: list[str]


def answer_question(
    db: Session,
    *,
    question: str,
    locale: str = "bn",
    history: list[ConversationTurn] | None = None,
    user_id: int | None = None,
) -> CopilotAnswer:
    """Retrieve relevant opportunities and produce a grounded answer."""
    locale_norm = "en" if locale == "en" else "bn"
    matches = _retrieve(db, question)

    if not matches:
        empty_msg = (
            "আমি আপনার প্রশ্নের সঙ্গে মিলে এমন কোনো প্রকাশিত সুযোগ খুঁজে পাইনি। অনুগ্রহ করে অন্যভাবে জিজ্ঞাসা করুন বা পরে আবার চেষ্টা করুন।"
            if locale_norm == "bn"
            else "I couldn't find any published opportunities matching your question. Try rephrasing or check back later."
        )
        return CopilotAnswer(
            answer=empty_msg,
            locale=locale_norm,
            citations=[],
            suggested_follow_ups=_fallback_follow_ups([], locale_norm),
        )

    saved_ids = _saved_ids_for_user(db, user_id=user_id, opportunity_ids=[opp.id for opp in matches])
    citations = [_to_citation(opp, saved_ids=saved_ids) for opp in matches]

    api_key = get_ai_api_key(db)
    if not api_key:
        return CopilotAnswer(
            answer=_fallback_answer(matches, locale_norm),
            locale=locale_norm,
            citations=citations,
            suggested_follow_ups=_fallback_follow_ups(matches, locale_norm),
        )

    try:
        answer_text, follow_ups = _generate_answer(
            db,
            api_key=api_key,
            question=question,
            matches=matches,
            locale=locale_norm,
            history=history or [],
        )
    except Exception as exc:
        logger.warning("rag_generate_failed", extra={"error": str(exc)})
        answer_text = _fallback_answer(matches, locale_norm)
        follow_ups = _fallback_follow_ups(matches, locale_norm)

    return CopilotAnswer(
        answer=answer_text,
        locale=locale_norm,
        citations=citations,
        suggested_follow_ups=follow_ups[:3],
    )


def _saved_ids_for_user(db: Session, *, user_id: int | None, opportunity_ids: list[int]) -> set[int]:
    if user_id is None or not opportunity_ids:
        return set()
    stmt = (
        select(SavedOpportunity.opportunity_id)
        .where(
            SavedOpportunity.user_id == user_id,
            SavedOpportunity.opportunity_id.in_(opportunity_ids),
        )
    )
    return set(db.scalars(stmt).all())


def _retrieve(db: Session, question: str) -> list[Opportunity]:
    vector = embed_query(question)
    distance = OpportunityEmbedding.embedding.cosine_distance(vector)
    stmt = (
        select(Opportunity)
        .join(OpportunityEmbedding, OpportunityEmbedding.opportunity_id == Opportunity.id)
        .where(Opportunity.status == "published", Opportunity.is_active.is_(True))
        .where(Opportunity.admin_status.notin_(["hidden", "archived", "inactive", "rejected"]))
        .order_by(distance)
        .limit(_TOP_K)
    )
    return list(db.scalars(stmt).all())


def _generate_answer(
    db: Session,
    api_key: str,
    question: str,
    matches: list[Opportunity],
    locale: str,
    history: list[ConversationTurn],
) -> tuple[str, list[str]]:
    provider = get_ai_provider(db)
    context = _build_context(matches)
    history_text = _build_history_context(history)
    lang_label = "Bengali (Bangla)" if locale == "bn" else "English"
    follow_up_language = "Bangla" if locale == "bn" else "English"

    prompt = (
        "You are a helpful assistant for a Bangladeshi overseas-opportunity "
        "platform. Answer the user's question using ONLY the information in the "
        "context below. The audience is a rural Bangladeshi job-seeker - use "
        "simple, respectful, plain language.\n\n"
        f"Respond in {lang_label}.\n"
        f"Write follow-up suggestions in {follow_up_language}.\n\n"
        "Use the conversation history only to understand continuity and pronouns. "
        "Use fresh retrieval context for facts.\n\n"
        "Explain why a job may fit the user, education/experience needed, Bangladesh suitability, "
        "documents, warnings, and safe application steps when present. Never claim guaranteed visa, "
        "guaranteed job, or guaranteed selection.\n\n"
        "Cite specific opportunities by their ID number in square brackets, "
        "e.g. [#42], so the UI can deep-link them. Mention 2-3 most relevant "
        "opportunities. If the context doesn't contain a good match, say so honestly.\n\n"
        "Return strict JSON with this exact shape:\n"
        "{\"answer\": \"...\", \"suggested_follow_ups\": [\"...\", \"...\", \"...\"]}\n"
        "The suggested_follow_ups list must contain 0 to 3 short, concrete next questions.\n\n"
        f"CONVERSATION HISTORY:\n{history_text}\n\n"
        f"USER QUESTION:\n{question}\n\n"
        f"CONTEXT (top-{len(matches)} retrieved opportunities):\n{context}\n"
    )

    if provider == "mistral":
        response = httpx.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": get_ai_model(db),
                "temperature": 0.2,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=60,
        )
        response.raise_for_status()
        raw = str(response.json()["choices"][0]["message"]["content"]).strip()
    else:
        model = ChatGroq(model=get_ai_model(db), api_key=api_key, temperature=0.2)
        raw = str(model.invoke(prompt).content).strip()

    return _parse_answer_payload(raw, locale=locale, matches=matches)


def _parse_answer_payload(raw: str, *, locale: str, matches: list[Opportunity]) -> tuple[str, list[str]]:
    candidate = raw
    if "```" in raw:
        parts = [part.strip() for part in raw.split("```") if part.strip()]
        json_like = next((part for part in parts if part.startswith("{") or "\n{" in part), None)
        if json_like:
            candidate = json_like.split("\n", 1)[-1] if json_like.startswith("json") else json_like

    try:
        payload = json.loads(candidate)
        answer = str(payload.get("answer") or "").strip()
        follow_ups = _normalize_follow_ups(payload.get("suggested_follow_ups"), locale=locale, matches=matches)
        if answer:
            return answer, follow_ups
    except Exception:
        logger.debug("rag_json_parse_failed", extra={"raw": raw[:300]})

    return raw.strip(), _fallback_follow_ups(matches, locale)


def _build_context(matches: list[Opportunity]) -> str:
    parts: list[str] = []
    used = 0
    for opp in matches:
        block = _opp_to_context(opp)
        if used + len(block) > _CONTEXT_BUDGET:
            break
        parts.append(block)
        used += len(block)
    return "\n\n---\n\n".join(parts)


def _build_history_context(history: list[ConversationTurn]) -> str:
    if not history:
        return "No previous messages."

    lines: list[str] = []
    used = 0
    for turn in history[-_HISTORY_TURN_LIMIT:]:
        role = "User" if turn.role == "user" else "Assistant"
        line = f"{role}: {turn.content.strip()[:400]}"
        if used + len(line) > _HISTORY_BUDGET:
            break
        lines.append(line)
        used += len(line)
    return "\n".join(lines) if lines else "No previous messages."


def _opp_to_context(opp: Opportunity) -> str:
    lines = [
        f"#{opp.id}: {opp.title or 'Untitled'}",
    ]
    if opp.title_bn:
        lines.append(f"Bangla title: {opp.title_bn}")
    if opp.country:
        lines.append(f"Country: {opp.country}")
    if opp.employer_or_organization or opp.employer:
        lines.append(f"Employer: {opp.employer_or_organization or opp.employer}")
    if opp.deadline:
        lines.append(f"Deadline: {opp.deadline}")
    if opp.salary_text or opp.salary_min:
        salary = opp.salary_text or f"{opp.salary_min}-{opp.salary_max or ''} {opp.salary_currency or ''}".strip()
        lines.append(f"Salary: {salary}")
    if opp.eligibility_text:
        lines.append(f"Eligibility: {opp.eligibility_text[:300]}")
    if opp.education_min or opp.education_requirement:
        lines.append(f"Education: {(opp.education_min or opp.education_requirement)[:220]}")
    if opp.experience_min_years is not None or opp.experience_requirement:
        lines.append(f"Experience: {opp.experience_min_years if opp.experience_min_years is not None else opp.experience_requirement}")
    if opp.bangladesh_applicability:
        lines.append(f"Bangladesh suitability: {opp.bangladesh_applicability} - {opp.bangladesh_applicability_reason or 'No reason recorded'}")
    if opp.documents_needed or opp.documents_required:
        docs = opp.documents_needed or opp.documents_required
        lines.append(f"Documents: {', '.join(docs[:6])}")
    if opp.extraction_warnings:
        lines.append(f"Warnings: {', '.join(opp.extraction_warnings[:5])}")
    if opp.application_url or opp.original_apply_url:
        lines.append(f"Apply safely through: {opp.application_url or opp.original_apply_url}")
    summary = opp.summary_bn or opp.summary_en or opp.summary
    if summary:
        lines.append(f"Summary: {summary[:400]}")
    return "\n".join(lines)


def _to_citation(opp: Opportunity, *, saved_ids: set[int]) -> CopilotCitation:
    return CopilotCitation(
        opportunity_id=opp.id,
        title=opp.title or "Untitled",
        title_bn=opp.title_bn,
        title_en=getattr(opp, "title_en", None),
        opportunity_type=opp.opportunity_type,
        country=opp.country,
        destination_country=opp.destination_country,
        deadline=str(opp.deadline) if opp.deadline else None,
        employer_or_organization=opp.employer_or_organization or opp.employer,
        salary_min=float(opp.salary_min) if opp.salary_min is not None else None,
        salary_max=float(opp.salary_max) if opp.salary_max is not None else None,
        salary_currency=opp.salary_currency,
        salary_text=opp.salary_text,
        salary_text_bn=getattr(opp, "salary_text_bn", None),
        can_apply_from_bd=opp.can_apply_from_bd,
        source_trust_badge=opp.source_trust_badge,
        source_url=opp.source_page_url or opp.source_url or "",
        is_saved=opp.id in saved_ids,
        summary=opp.summary_en or opp.summary,
        summary_bn=opp.summary_bn,
    )


def _fallback_answer(matches: list[Opportunity], locale: str) -> str:
    if locale == "bn":
        intro = "AI উপলব্ধ নেই - আপনার প্রশ্নের সঙ্গে মেলে এমন সুযোগগুলো নিচে দেওয়া হলো:"
    else:
        intro = "AI is unavailable - here are the opportunities most relevant to your question:"
    bullets = [f"- [#{o.id}] {o.title}" + (f" ({o.country})" if o.country else "") for o in matches]
    return intro + "\n" + "\n".join(bullets)


def _normalize_follow_ups(raw: object, *, locale: str, matches: list[Opportunity]) -> list[str]:
    if not isinstance(raw, list):
        return _fallback_follow_ups(matches, locale)

    cleaned: list[str] = []
    for item in raw:
        text = str(item).strip()
        if not text or text in cleaned:
            continue
        cleaned.append(text[:220])
        if len(cleaned) == 3:
            break
    return cleaned or _fallback_follow_ups(matches, locale)


def _fallback_follow_ups(matches: list[Opportunity], locale: str) -> list[str]:
    top = matches[0] if matches else None
    if locale == "bn":
        suggestions = [
            "এই সুযোগে আবেদন করার ধাপগুলো কী?",
            "বাংলাদেশ থেকে আবেদন করা যাবে কি?",
            "আরও মিল আছে এমন চাকরি দেখাও",
        ]
        if top and top.country:
            suggestions[2] = f"{top.country} এর আরও মিল আছে এমন সুযোগ দেখাও"
    else:
        suggestions = [
            "What are the application steps for this opportunity?",
            "Can I apply from Bangladesh for this?",
            "Show me more similar jobs",
        ]
        if top and top.country:
            suggestions[2] = f"Show me more similar opportunities in {top.country}"
    return suggestions
