from datetime import UTC
from typing import Any

import httpx
from langchain_groq import ChatGroq
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Opportunity, Source
from app.schemas.copilot import CopilotCitation, CopilotResponse
from app.schemas.opportunity import OpportunitySearchQuery
from app.services.runtime_settings_service import get_ai_api_key, get_ai_model, get_ai_provider
from app.services.search_service import search_opportunities


COUNTRY_HINTS = [
    "canada",
    "australia",
    "germany",
    "saudi",
    "qatar",
    "japan",
    "uk",
    "united kingdom",
]


def interpret_query(natural_text: str) -> OpportunitySearchQuery:
    text = natural_text.lower()
    record_type = None
    if "scholarship" in text:
        record_type = "scholarship"
    elif "policy" in text or "circular" in text:
        record_type = "policy_update"
    elif "job" in text:
        record_type = "job"

    country = next((c for c in COUNTRY_HINTS if c in text), None)
    visa_support = True if "visa" in text and ("support" in text or "sponsor" in text) else None

    return OpportunitySearchQuery(
        q=natural_text,
        semantic_q=natural_text,
        record_type=record_type,
        country=country,
        visa_support=visa_support,
        sort="relevance",
        page=1,
        page_size=6,
    )


def _build_citations(rows: list[tuple[Opportunity, Source]]) -> list[CopilotCitation]:
    citations: list[CopilotCitation] = []
    for opp, source in rows:
        citations.append(
            CopilotCitation(
                opportunity_id=opp.id,
                title=opp.title,
                source_url=opp.source_url,
                trust_tier=source.trust_tier.value if source.trust_tier else "unknown",
                fetched_at=None,
                extraction_confidence=opp.extraction_confidence,
            )
        )
    return citations


def _llm_answer(db: Session, question: str, context: list[dict[str, Any]]) -> str:
    api_key = get_ai_api_key(db)
    if not api_key:
        return (
            "Based on indexed opportunities only, prioritize official sources with active deadlines, "
            "review stated eligibility, and apply through the provided source links."
        )

    prompt = (
        "You are a strict opportunity assistant. Use only provided context. If unknown, say unknown.\n"
        f"Question: {question}\n"
        f"Context: {context}\n"
        "Respond in concise bullet-style prose without hallucinations."
    )
    provider = get_ai_provider(db)
    if provider == "mistral":
        response = httpx.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": get_ai_model(db),
                "temperature": 0.1,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=60,
        )
        response.raise_for_status()
        return str(response.json()["choices"][0]["message"]["content"])

    model = ChatGroq(
        model=get_ai_model(db),
        api_key=api_key,
        temperature=0.1,
    )
    result = model.invoke(prompt)
    return str(result.content)


def _fetch_published_rows(db: Session, ids: list[int]) -> list[tuple[Opportunity, Source]]:
    return db.execute(
        select(Opportunity, Source)
        .join(Source, Source.id == Opportunity.source_id, isouter=True)
        .where(
            Opportunity.id.in_(ids),
            Opportunity.status == "published",
            Opportunity.is_active.is_(True),
            Opportunity.admin_status.notin_(["hidden", "archived", "inactive", "rejected"]),
        )
    ).all()


def run_copilot_query(db: Session, question: str) -> CopilotResponse:
    parsed = interpret_query(question)
    search = search_opportunities(db, parsed)
    if not search.items:
        return CopilotResponse(answer="No matching indexed opportunities were found.", citations=[])

    ids = [x.id for x in search.items]
    rows = _fetch_published_rows(db, ids)
    context = [
        {
            "id": opp.id,
            "title": opp.title,
            "summary": opp.summary_en or opp.summary,
            "country": opp.country,
            "deadline": str(opp.deadline) if opp.deadline else None,
            "trust_badge": opp.source_trust_badge,
            "bangladesh_applicability": opp.bangladesh_applicability,
            "warnings": opp.extraction_warnings,
            "source_url": opp.source_url,
        }
        for opp, source in rows
    ]
    answer = _llm_answer(db, question, context)
    return CopilotResponse(answer=answer, citations=_build_citations(rows))


def compare_opportunities(db: Session, left_id: int, right_id: int) -> CopilotResponse:
    rows = _fetch_published_rows(db, [left_id, right_id])
    if len(rows) < 2:
        return CopilotResponse(answer="One or both opportunities were not found.", citations=[])

    left, right = rows[0], rows[1]
    left_opp, left_src = left
    right_opp, right_src = right
    answer = (
        f"{left_opp.title} vs {right_opp.title}: compare trust "
        f"({left_opp.source_trust_badge or 'unknown'} vs {right_opp.source_trust_badge or 'unknown'}), "
        f"deadline ({left_opp.deadline} vs {right_opp.deadline}), "
        "and explicit requirements before applying."
    )
    return CopilotResponse(answer=answer, citations=_build_citations(rows))


def explain_match(db: Session, opportunity_id: int) -> CopilotResponse:
    rows = _fetch_published_rows(db, [opportunity_id])
    if not rows:
        return CopilotResponse(answer="Opportunity not found.", citations=[])

    opp, source = rows[0]
    answer = (
        f"This opportunity matches by content relevance and trust weighting. "
        f"Trust badge: {opp.source_trust_badge or 'none'}, "
        f"extraction confidence: {opp.extraction_confidence:.2f}, "
        f"actionability score: {opp.actionability_score:.2f}."
    )
    return CopilotResponse(answer=answer, citations=_build_citations(rows))
