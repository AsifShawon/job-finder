from datetime import UTC
from typing import Any

from langchain_groq import ChatGroq
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Opportunity, Source
from app.schemas.copilot import CopilotCitation, CopilotResponse
from app.schemas.opportunity import OpportunitySearchQuery
from app.services.runtime_settings_service import get_ai_api_key, get_ai_model, get_ai_provider
from app.services.search_service import search_opportunities


BANGLA_COUNTRY_MAP = {
    "সৌদি": "saudi arabia",
    "মালয়েশিয়া": "malaysia",
    "কাতার": "qatar",
    "দুবাই": "united arab emirates",
    "ইউএই": "united arab emirates",
    "সংযুক্ত আরব আমিরাত": "united arab emirates",
    "কুয়েত": "kuwait",
    "ওমান": "oman",
    "জার্মানি": "germany",
    "কানাডা": "canada",
    "ক্যানাডা": "canada",
    "অস্ট্রেলিয়া": "australia",
}

ENGLISH_COUNTRY_MAP = {
    "saudi": "saudi arabia",
    "saudi arabia": "saudi arabia",
    "malaysia": "malaysia",
    "qatar": "qatar",
    "dubai": "united arab emirates",
    "uae": "united arab emirates",
    "united arab emirates": "united arab emirates",
    "kuwait": "kuwait",
    "oman": "oman",
    "germany": "germany",
    "canada": "canada",
    "australia": "australia",
    "uk": "united kingdom",
    "united kingdom": "united kingdom",
    "japan": "japan",
}


def interpret_query(natural_text: str) -> OpportunitySearchQuery:
    text = natural_text.lower()
    record_type = None
    if "scholarship" in text or "স্কলারশিপ" in text:
        record_type = "scholarship"
    elif "policy" in text or "circular" in text or "সার্কুলার" in text or "নোটিশ" in text:
        record_type = "policy_update"
    elif "job" in text or "work" in text or "চাকরি" in text or "কাজ" in text:
        record_type = "job"

    country = None
    for bn_k, en_v in BANGLA_COUNTRY_MAP.items():
        if bn_k in text:
            country = en_v
            break
    if not country:
        for en_k, en_v in ENGLISH_COUNTRY_MAP.items():
            if en_k in text:
                country = en_v
                break

    visa_support = None
    if "visa" in text or "sponsor" in text or "sponsorship" in text or "ভিসা" in text:
        visa_support = True

    can_apply_from_bd = None
    if "apply from bangladesh" in text or "bangladesh থেকে" in text or "বাংলাদেশ থেকে আবেদন" in text:
        can_apply_from_bd = True

    sort = "relevance"
    if "salary" in text or "pay" in text or "বেতন" in text:
        sort = "salary"
    elif "deadline" in text or "closing soon" in text or "শেষ তারিখ" in text:
        sort = "deadline"

    return OpportunitySearchQuery(
        q=natural_text,
        semantic_q=natural_text,
        record_type=record_type,
        country=country,
        visa_support=visa_support,
        can_apply_from_bd=can_apply_from_bd,
        sort=sort,
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
            "[SHORT_ANSWER]\nBased on indexed opportunities only, prioritize official sources with active deadlines.\n\n"
            "[WHY_MATCH]\nThis fits your search intent.\n\n"
            "[SAFETY]\nReview stated eligibility and apply through the provided source links.\n\n"
            "[NEXT_STEPS]\nTap details to verify."
        )

    prompt = (
        "You are a helpful Bangla-first job adviser for low-literacy Bangladeshi workers. "
        "Answer the user's question using ONLY the provided context. If unknown, say unknown.\n"
        "Do not invent salary, visa, deadline, cost, eligibility, or Bangladesh applicability.\n"
        "You MUST structure your response using the following exact tag blocks. Do not omit any tags.\n\n"
        "[SHORT_ANSWER]\n"
        "Write 1 or 2 very simple sentences answering the user's question. If no matches, state it simply.\n\n"
        "[WHY_MATCH]\n"
        "Briefly explain why the matching opportunities fit the query.\n\n"
        "[SAFETY]\n"
        "Highlight any warnings or missing details in the context (like missing salary, visa, cost, or eligibility).\n\n"
        "[NEXT_STEPS]\n"
        "Tell the user exactly what to do next.\n\n"
        f"Question: {question}\n"
        f"Context: {context}\n"
    )
    provider = get_ai_provider(db)
    if provider == "mistral":
        from app.services.mistral_client import mistral_chat_text
        return mistral_chat_text(api_key, get_ai_model(db), prompt, temperature=0.1)

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
        return CopilotResponse(
            answer=(
                "[SHORT_ANSWER]\nএই প্রশ্নের সাথে মিল থাকা প্রকাশিত সুযোগ এখন পাওয়া যায়নি। আপনি দেশ, কাজের ধরন বা পড়াশোনা লিখে আবার চেষ্টা করতে পারেন।\n\n"
                "[WHY_MATCH]\nকোনো মিল পাওয়া যায়নি।\n\n"
                "[SAFETY]\nটাকা বা ব্যক্তিগত কাগজ দেওয়ার আগে অফিশিয়াল উৎস ও নিয়োগকারী যাচাই করুন।\n\n"
                "[NEXT_STEPS]\nদেশ, কাজের ধরন বা পড়াশোনা পরিবর্তন করে নতুনভাবে প্রশ্ন করুন।"
            ),
            citations=[]
        )

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

    left_opp, left_src = rows[0]
    right_opp, right_src = rows[1]

    # 1. Safer check
    left_badge = left_opp.source_trust_badge or "সাধারণ"
    right_badge = right_opp.source_trust_badge or "সাধারণ"
    left_score = left_opp.trust_score or 0.0
    right_score = right_opp.trust_score or 0.0
    
    if left_score > right_score:
        safer_text = f"'{left_opp.title}' বেশি নিরাপদ মনে হচ্ছে (উৎস: {left_badge})।"
    elif right_score > left_score:
        safer_text = f"'{right_opp.title}' বেশি নিরাপদ মনে হচ্ছে (উৎস: {right_badge})।"
    else:
        safer_text = f"উভয়টিরই নিরাপত্তা মান সমান (উৎস: {left_badge} এবং {right_badge})।"

    # 2. Deadline check
    left_dl = str(left_opp.deadline) if left_opp.deadline else None
    right_dl = str(right_opp.deadline) if right_opp.deadline else None
    if left_dl and right_dl:
        deadline_text = f"উভয়টিরই শেষ তারিখ স্পষ্ট। '{left_opp.title}' এর শেষ তারিখ {left_dl}, এবং '{right_opp.title}' এর শেষ তারিখ {right_dl}।"
    elif left_dl:
        deadline_text = f"'{left_opp.title}' এর শেষ তারিখ স্পষ্ট ({left_dl})। কিন্তু '{right_opp.title}' এর শেষ তারিখ দেওয়া নেই।"
    elif right_dl:
        deadline_text = f"'{right_opp.title}' এর শেষ তারিখ স্পষ্ট ({right_dl})। কিন্তু '{left_opp.title}' এর শেষ তারিখ দেওয়া নেই।"
    else:
        deadline_text = "কোনোটিরই নির্দিষ্ট শেষ তারিখ পাওয়া যায়নি।"

    # 3. Eligibility check
    left_elig = left_opp.education_min or left_opp.education_requirement or left_opp.eligibility_text
    right_elig = right_opp.education_min or right_opp.education_requirement or right_opp.eligibility_text
    if left_elig and right_elig:
        eligibility_text = "উভয়টিরই আবেদনের যোগ্যতা স্পষ্ট উল্লেখ আছে।"
    elif left_elig:
        eligibility_text = f"'{left_opp.title}' এর আবেদনের যোগ্যতা স্পষ্ট উল্লেখ আছে। কিন্তু '{right_opp.title}' এর যোগ্যতা স্পষ্ট নয়।"
    elif right_elig:
        eligibility_text = f"'{right_opp.title}' এর আবেদনের যোগ্যতা স্পষ্ট উল্লেখ আছে। কিন্তু '{left_opp.title}' এর যোগ্যতা স্পষ্ট নয়।"
    else:
        eligibility_text = "কোনোটিরই যোগ্যতা স্পষ্ট উল্লেখ নেই।"

    # 4. Salary check
    left_sal = left_opp.salary_text or left_opp.salary_text_bn or (f"{left_opp.salary_min} {left_opp.salary_currency}" if left_opp.salary_min else None)
    right_sal = right_opp.salary_text or right_opp.salary_text_bn or (f"{right_opp.salary_min} {right_opp.salary_currency}" if right_opp.salary_min else None)
    if left_sal and right_sal:
        salary_text = f"উভয়টিরই বেতন স্পষ্ট। '{left_opp.title}': {left_sal}, এবং '{right_opp.title}': {right_sal}।"
    elif left_sal:
        salary_text = f"'{left_opp.title}' এর বেতন স্পষ্ট ({left_sal})। কিন্তু '{right_opp.title}' এর বেতন স্পষ্ট নয়।"
    elif right_sal:
        salary_text = f"'{right_opp.title}' এর বেতন স্পষ্ট ({right_sal})। কিন্তু '{left_opp.title}' এর বেতন স্পষ্ট নয়।"
    else:
        salary_text = "কোনোটিরই বেতন নির্দিষ্টভাবে উল্লেখ নেই।"

    # 5. Check first
    left_rank = left_opp.overall_rank_score or 0.0
    right_rank = right_opp.overall_rank_score or 0.0
    if left_rank >= right_rank:
        first_check = f"আমরা আপনাকে প্রথমে '{left_opp.title}' চেক করার পরামর্শ দিই।"
    else:
        first_check = f"আমরা আপনাকে প্রথমে '{right_opp.title}' চেক করার পরামর্শ দিই।"

    answer = (
        f"[SHORT_ANSWER]\nনিচে সুযোগ দুটির তুলনামূলক বিবরণ দেওয়া হলো:\n\n"
        f"[WHY_MATCH]\n**১. নিরাপত্তা:** {safer_text}\n"
        f"**২. আবেদনের শেষ তারিখ:** {deadline_text}\n"
        f"**৩. যোগ্যতা:** {eligibility_text}\n"
        f"**৪. বেতন:** {salary_text}\n\n"
        f"[SAFETY]\nকোনো প্রকার আর্থিক লেনদেন করার পূর্বে সতর্ক থাকুন এবং নিয়োগকারীর সত্যতা অফিশিয়াল মাধ্যমে যাচাই করুন।\n\n"
        f"[NEXT_STEPS]\n{first_check}"
    )

    return CopilotResponse(answer=answer, citations=_build_citations(rows))


def explain_match(db: Session, opportunity_id: int) -> CopilotResponse:
    rows = _fetch_published_rows(db, [opportunity_id])
    if not rows:
        return CopilotResponse(answer="Opportunity not found.", citations=[])

    opp, source = rows[0]
    
    # 1. Why this appeared
    why_appeared = (
        f"এই সুযোগটি আমাদের সিস্টেমে প্রকাশিত এবং এটি '{opp.country or 'বিভিন্ন দেশ'}' এর জন্য প্রযোজ্য।"
    )
    
    # 2. What matches user query/profile
    trust_tier_desc = source.trust_tier.value if source.trust_tier else "unknown"
    matches_profile = (
        f"উৎস ট্রাস্ট লেভেল: {trust_tier_desc} (Trust score: {opp.trust_score:.2f})। "
        f"যোগ্যতার বিবরণ ও বিবরণীর সাথে এটি সামঞ্জস্যপূর্ণ।"
    )

    # 3. What information is missing
    missing_info = []
    if not opp.deadline:
        missing_info.append("আবেদনের শেষ তারিখ")
    if not opp.salary_min and not opp.salary_text:
        missing_info.append("নির্দিষ্ট বেতন")
    if not opp.education_min and not opp.education_requirement:
        missing_info.append("শিক্ষাগত যোগ্যতা")
    if not opp.documents_needed and not opp.documents_required:
        missing_info.append("প্রয়োজনীয় কাগজপত্র")

    if missing_info:
        missing_text = f"এই তথ্যগুলো উৎসে স্পষ্ট নয়: {', '.join(missing_info)}।"
    else:
        missing_text = "প্রয়োজনীয় সব প্রধান তথ্য উৎসে স্পষ্ট রয়েছে।"

    # 4. What to verify before applying
    verify_text = (
        "নিয়োগকারীর সত্যতা এবং অফিশিয়াল সার্কুলার লিঙ্কটি পুনরায় যাচাই করুন।"
    )

    answer = (
        f"[SHORT_ANSWER]\nসুযোগটির বিস্তারিত বিবরণ নিচে দেওয়া হলো:\n\n"
        f"[WHY_MATCH]\n**১. কেন এই সুযোগটি দেখানো হচ্ছে:** {why_appeared}\n"
        f"**২. কী কী মিল রয়েছে:** {matches_profile}\n\n"
        f"[SAFETY]\n**৩. কী কী তথ্য অস্পষ্ট বা অনুপস্থিত:** {missing_text}\n"
        f"টাকা বা ব্যক্তিগত কাগজপত্র দেওয়ার ক্ষেত্রে অতিরিক্ত সতর্কতা অবলম্বন করুন।\n\n"
        f"[NEXT_STEPS]\n**৪. আবেদনের আগে কী যাচাই করবেন:** {verify_text}"
    )

    return CopilotResponse(answer=answer, citations=_build_citations(rows))
