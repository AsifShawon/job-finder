from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.entities import CopilotConversation, CopilotMessage
from app.schemas.copilot import (
    CopilotChatCitation,
    CopilotConversationDetail,
    CopilotConversationListItem,
    CopilotMessageOut,
    CopilotSuggestedFollowUp,
)
from app.services.rag_service import ConversationTurn, answer_question

_DEFAULT_TITLE = "New chat"
_TITLE_MAX = 80


def list_conversations(db: Session, *, user_id: int) -> list[CopilotConversationListItem]:
    conversations = db.scalars(
        select(CopilotConversation)
        .where(CopilotConversation.user_id == user_id)
        .order_by(CopilotConversation.last_message_at.desc(), CopilotConversation.id.desc())
        .limit(50)
    ).all()

    items: list[CopilotConversationListItem] = []
    for conversation in conversations:
        latest = db.scalar(
            select(CopilotMessage.content)
            .where(CopilotMessage.conversation_id == conversation.id)
            .order_by(CopilotMessage.created_at.desc(), CopilotMessage.id.desc())
            .limit(1)
        )
        items.append(
            CopilotConversationListItem(
                id=conversation.id,
                title=conversation.title,
                locale=conversation.locale,
                last_message_preview=_preview(latest),
                updated_at=conversation.updated_at,
                last_message_at=conversation.last_message_at,
            )
        )
    return items


def create_conversation(db: Session, *, user_id: int, locale: str) -> CopilotConversationDetail:
    conversation = CopilotConversation(
        user_id=user_id,
        title=_DEFAULT_TITLE,
        locale=_normalize_locale(locale),
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return _serialize_conversation(conversation)


def get_conversation_detail(db: Session, *, user_id: int, conversation_id: int) -> CopilotConversationDetail:
    conversation = _get_owned_conversation(db, user_id=user_id, conversation_id=conversation_id, with_messages=True)
    return _serialize_conversation(conversation)


def delete_conversation(db: Session, *, user_id: int, conversation_id: int) -> None:
    conversation = _get_owned_conversation(db, user_id=user_id, conversation_id=conversation_id)
    db.delete(conversation)
    db.commit()


def add_message(
    db: Session,
    *,
    user_id: int,
    conversation_id: int,
    question: str,
    locale: str | None = None,
) -> CopilotMessageOut:
    conversation = _get_owned_conversation(db, user_id=user_id, conversation_id=conversation_id, with_messages=True)
    question_text = question.strip()
    if not question_text:
        raise HTTPException(status_code=422, detail="Question cannot be empty")

    effective_locale = _normalize_locale(locale or conversation.locale)
    history = [
        ConversationTurn(role=message.role, content=message.content)
        for message in conversation.messages
    ]

    user_message = CopilotMessage(
        conversation_id=conversation.id,
        role="user",
        content=question_text,
        citations_json=[],
        suggested_follow_ups_json=[],
    )
    db.add(user_message)
    db.flush()

    result = answer_question(
        db,
        question=question_text,
        locale=effective_locale,
        history=history,
        user_id=user_id,
    )

    assistant_citations = [citation.model_dump() for citation in _serialize_citations(result.citations)]
    follow_ups = [item.text for item in _serialize_follow_ups(result.suggested_follow_ups)]

    assistant_message = CopilotMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=result.answer,
        citations_json=assistant_citations,
        suggested_follow_ups_json=follow_ups,
    )
    db.add(assistant_message)

    now = datetime.now(UTC)
    conversation.locale = effective_locale
    if conversation.title == _DEFAULT_TITLE and not history:
        conversation.title = _build_title(question_text)
    conversation.last_message_at = now
    conversation.updated_at = now

    db.commit()
    db.refresh(assistant_message)
    return _serialize_message(assistant_message)


def add_message_pair(
    db: Session,
    *,
    user_id: int,
    conversation_id: int,
    question: str,
    locale: str | None = None,
) -> tuple[CopilotMessageOut, CopilotMessageOut]:
    conversation = _get_owned_conversation(db, user_id=user_id, conversation_id=conversation_id, with_messages=True)
    question_text = question.strip()
    if not question_text:
        raise HTTPException(status_code=422, detail="Question cannot be empty")

    effective_locale = _normalize_locale(locale or conversation.locale)
    history = [
        ConversationTurn(role=message.role, content=message.content)
        for message in conversation.messages
    ]

    user_message = CopilotMessage(
        conversation_id=conversation.id,
        role="user",
        content=question_text,
        citations_json=[],
        suggested_follow_ups_json=[],
    )
    db.add(user_message)
    db.flush()

    result = answer_question(
        db,
        question=question_text,
        locale=effective_locale,
        history=history,
        user_id=user_id,
    )

    assistant_citations = [citation.model_dump() for citation in _serialize_citations(result.citations)]
    follow_ups = [item.text for item in _serialize_follow_ups(result.suggested_follow_ups)]

    assistant_message = CopilotMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=result.answer,
        citations_json=assistant_citations,
        suggested_follow_ups_json=follow_ups,
    )
    db.add(assistant_message)

    now = datetime.now(UTC)
    conversation.locale = effective_locale
    if conversation.title == _DEFAULT_TITLE and not history:
        conversation.title = _build_title(question_text)
    conversation.last_message_at = now
    conversation.updated_at = now

    db.commit()
    db.refresh(user_message)
    db.refresh(assistant_message)
    return _serialize_message(user_message), _serialize_message(assistant_message)


def _get_owned_conversation(
    db: Session,
    *,
    user_id: int,
    conversation_id: int,
    with_messages: bool = False,
) -> CopilotConversation:
    stmt = select(CopilotConversation).where(
        CopilotConversation.id == conversation_id,
        CopilotConversation.user_id == user_id,
    )
    if with_messages:
        stmt = stmt.options(selectinload(CopilotConversation.messages))
    conversation = db.scalar(stmt)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


def _serialize_conversation(conversation: CopilotConversation) -> CopilotConversationDetail:
    return CopilotConversationDetail(
        id=conversation.id,
        title=conversation.title,
        locale=conversation.locale,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        last_message_at=conversation.last_message_at,
        messages=[_serialize_message(message) for message in conversation.messages],
    )


def _serialize_message(message: CopilotMessage) -> CopilotMessageOut:
    return CopilotMessageOut(
        id=message.id,
        role=message.role,
        content=message.content,
        citations=_deserialize_citations(message.citations_json),
        suggested_follow_ups=_deserialize_follow_ups(message.suggested_follow_ups_json),
        created_at=message.created_at,
    )


def _serialize_citations(citations: list[object]) -> list[CopilotChatCitation]:
    return [
        CopilotChatCitation(**citation.__dict__)
        if hasattr(citation, "__dict__")
        else CopilotChatCitation.model_validate(citation)
        for citation in citations
    ]


def _serialize_follow_ups(items: list[str]) -> list[CopilotSuggestedFollowUp]:
    return [CopilotSuggestedFollowUp(text=item) for item in items[:3] if item.strip()]


def _deserialize_citations(raw: list[dict] | None) -> list[CopilotChatCitation]:
    if not raw:
        return []
    return [CopilotChatCitation.model_validate(item) for item in raw]


def _deserialize_follow_ups(raw: list[str] | None) -> list[CopilotSuggestedFollowUp]:
    if not raw:
        return []
    return [CopilotSuggestedFollowUp(text=item) for item in raw[:3] if str(item).strip()]


def _build_title(question: str) -> str:
    normalized = " ".join(question.split())
    if len(normalized) <= _TITLE_MAX:
        return normalized
    return normalized[: _TITLE_MAX - 1].rstrip() + "…"


def _normalize_locale(locale: str) -> str:
    return "en" if locale == "en" else "bn"


def _preview(text: str | None) -> str | None:
    if not text:
        return None
    compact = " ".join(text.split())
    return compact[:120] + ("…" if len(compact) > 120 else "")
