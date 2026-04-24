from datetime import UTC
from typing import Any

from langchain_groq import ChatGroq
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Opportunity, RawDocument, Source
from app.schemas.copilot import CopilotCitation, CopilotResponse
from app.schemas.opportunity import OpportunitySearchQuery
from app.services.runtime_settings_service import get_groq_api_key, get_groq_model
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


def _build_citations(rows: list[tuple[Opportunity, Source, RawDocument | None]]) -> list[CopilotCitation]:
    citations: list[CopilotCitation] = []
    for opp, source, raw in rows:
        citations.append(
            CopilotCitation(
                opportunity_id=opp.id,
                title=opp.title,
                source_url=opp.source_url,
                trust_tier=source.trust_tier.value,
                fetched_at=raw.fetched_at if raw else None,
                extraction_confidence=opp.extraction_confidence,
            )
        )
    return citations


def _llm_answer(db: Session, question: str, context: list[dict[str, Any]]) -> str:
    groq_api_key = get_groq_api_key(db)
    if not groq_api_key:
        return (
            "Based on indexed opportunities only, prioritize official sources with active deadlines, "
            "review stated eligibility, and apply through the provided source links."
        )

    model = ChatGroq(
        model=get_groq_model(db),
        api_key=groq_api_key,
        temperature=0.1,
    )
    prompt = (
        "You are a strict opportunity assistant. Use only provided context. If unknown, say unknown.\n"
        f"Question: {question}\n"
        f"Context: {context}\n"
        "Respond in concise bullet-style prose without hallucinations."
    )
    result = model.invoke(prompt)
    return str(result.content)


def run_copilot_query(db: Session, question: str) -> CopilotResponse:
    parsed = interpret_query(question)
    search = search_opportunities(db, parsed)
    if not search.items:
        return CopilotResponse(answer="No matching indexed opportunities were found.", citations=[])

    ids = [x.id for x in search.items]
    rows = db.execute(
        select(Opportunity, Source, RawDocument)
        .join(Source, Source.id == Opportunity.source_id)
        .outerjoin(RawDocument, RawDocument.id == Opportunity.raw_document_id)
        .where(Opportunity.id.in_(ids))
    ).all()
    context = [
        {
            "id": opp.id,
            "title": opp.title,
            "summary": opp.summary,
            "country": opp.country,
            "deadline": str(opp.deadline) if opp.deadline else None,
            "trust_tier": source.trust_tier.value,
            "source_url": opp.source_url,
            "fetched_at": raw.fetched_at.astimezone(UTC).isoformat() if raw and raw.fetched_at else None,
        }
        for opp, source, raw in rows
    ]
    answer = _llm_answer(db, question, context)
    return CopilotResponse(answer=answer, citations=_build_citations(rows))


def compare_opportunities(db: Session, left_id: int, right_id: int) -> CopilotResponse:
    rows = db.execute(
        select(Opportunity, Source, RawDocument)
        .join(Source, Source.id == Opportunity.source_id)
        .outerjoin(RawDocument, RawDocument.id == Opportunity.raw_document_id)
        .where(Opportunity.id.in_([left_id, right_id]))
    ).all()
    if len(rows) < 2:
        return CopilotResponse(answer="One or both opportunities were not found.", citations=[])

    left, right = rows[0], rows[1]
    answer = (
        f"{left[0].title} vs {right[0].title}: compare trust ({left[1].trust_tier.value} vs {right[1].trust_tier.value}), "
        f"deadline ({left[0].deadline} vs {right[0].deadline}), and explicit requirements before applying."
    )
    return CopilotResponse(answer=answer, citations=_build_citations(rows))


def explain_match(db: Session, opportunity_id: int) -> CopilotResponse:
    row = db.execute(
        select(Opportunity, Source, RawDocument)
        .join(Source, Source.id == Opportunity.source_id)
        .outerjoin(RawDocument, RawDocument.id == Opportunity.raw_document_id)
        .where(Opportunity.id == opportunity_id)
    ).first()
    if not row:
        return CopilotResponse(answer="Opportunity not found.", citations=[])

    opp, source, raw = row
    answer = (
        f"This opportunity matches by content relevance and trust weighting. "
        f"Trust tier is {source.trust_tier.value}, extraction confidence is {opp.extraction_confidence:.2f}, "
        f"and actionability score is {opp.actionability_score:.2f}."
    )
    return CopilotResponse(answer=answer, citations=_build_citations([row]))
