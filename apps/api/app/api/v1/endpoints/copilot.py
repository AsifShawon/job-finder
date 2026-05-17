import json
import time
from collections.abc import Iterator

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.rate_limit import enforce_copilot_rate_limit
from app.db.session import get_db
from app.models.entities import User
from app.schemas.copilot import (
    CopilotChatCitation,
    CopilotChatRequest,
    CopilotChatResponse,
    CopilotCompareRequest,
    CopilotConversationCreateRequest,
    CopilotConversationDetail,
    CopilotConversationListItem,
    CopilotConversationMessageCreateRequest,
    CopilotExplainMatchRequest,
    CopilotMessageOut,
    CopilotQueryRequest,
    CopilotResponse,
    CopilotSuggestedFollowUp,
)
from app.services.copilot_chat_service import (
    add_message,
    add_message_pair,
    create_conversation,
    delete_conversation,
    get_conversation_detail,
    list_conversations,
)
from app.services.copilot_service import compare_opportunities, explain_match, run_copilot_query
from app.services.rag_service import answer_question as _rag_answer

router = APIRouter(prefix="/copilot", tags=["copilot"])


@router.post("/chat", response_model=CopilotChatResponse)
def chat(
    payload: CopilotChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CopilotChatResponse:
    """Legacy single-turn route kept for compatibility."""
    enforce_copilot_rate_limit(request)
    result = _rag_answer(db, question=payload.question, locale=payload.locale, user_id=user.id)
    return CopilotChatResponse(
        message_id=None,
        answer=result.answer,
        locale=result.locale,
        citations=[
            CopilotChatCitation(**citation.__dict__)
            for citation in result.citations
        ],
        suggested_follow_ups=[
            CopilotSuggestedFollowUp(text=item)
            for item in result.suggested_follow_ups
        ],
    )


@router.get("/conversations", response_model=list[CopilotConversationListItem])
def list_copilot_conversations(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CopilotConversationListItem]:
    enforce_copilot_rate_limit(request)
    return list_conversations(db, user_id=user.id)


@router.post("/conversations", response_model=CopilotConversationDetail, status_code=status.HTTP_201_CREATED)
def create_copilot_conversation(
    payload: CopilotConversationCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CopilotConversationDetail:
    enforce_copilot_rate_limit(request)
    return create_conversation(db, user_id=user.id, locale=payload.locale)


@router.get("/conversations/{conversation_id}", response_model=CopilotConversationDetail)
def get_copilot_conversation(
    conversation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CopilotConversationDetail:
    enforce_copilot_rate_limit(request)
    return get_conversation_detail(db, user_id=user.id, conversation_id=conversation_id)


@router.post("/conversations/{conversation_id}/messages", response_model=CopilotMessageOut)
def send_copilot_message(
    conversation_id: int,
    payload: CopilotConversationMessageCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CopilotMessageOut:
    enforce_copilot_rate_limit(request)
    return add_message(
        db,
        user_id=user.id,
        conversation_id=conversation_id,
        question=payload.question,
        locale=payload.locale,
    )


def _sse_event(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _token_chunks(text: str, *, size: int = 28) -> Iterator[str]:
    words = text.split(" ")
    chunk = ""
    for word in words:
        candidate = f"{chunk} {word}".strip()
        if len(candidate) >= size and chunk:
            yield f"{chunk} "
            chunk = word
        else:
            chunk = candidate
    if chunk:
        yield chunk


@router.post("/conversations/{conversation_id}/messages/stream")
def stream_copilot_message(
    conversation_id: int,
    payload: CopilotConversationMessageCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StreamingResponse:
    enforce_copilot_rate_limit(request)
    _, assistant = add_message_pair(
        db,
        user_id=user.id,
        conversation_id=conversation_id,
        question=payload.question,
        locale=payload.locale,
    )

    def events() -> Iterator[str]:
        yield _sse_event("start", {"conversation_id": conversation_id})
        for token in _token_chunks(assistant.content):
            yield _sse_event("token", {"text": token})
            time.sleep(0.015)
        citation_payload = [citation.model_dump(mode="json") for citation in assistant.citations]
        yield _sse_event("citations", {"items": citation_payload})
        yield _sse_event("recommendations", {"items": citation_payload})
        yield _sse_event(
            "done",
            {
                "message_id": assistant.id,
                "assistant": assistant.model_dump(mode="json"),
            },
        )

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_copilot_conversation(
    conversation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    enforce_copilot_rate_limit(request)
    delete_conversation(db, user_id=user.id, conversation_id=conversation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/query", response_model=CopilotResponse)
def query(
    payload: CopilotQueryRequest,
    request: Request,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> CopilotResponse:
    enforce_copilot_rate_limit(request)
    return run_copilot_query(db, payload.question)


@router.post("/compare", response_model=CopilotResponse)
def compare(
    payload: CopilotCompareRequest,
    request: Request,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> CopilotResponse:
    enforce_copilot_rate_limit(request)
    return compare_opportunities(db, payload.left_opportunity_id, payload.right_opportunity_id)


@router.post("/explain-match", response_model=CopilotResponse)
def explain(
    payload: CopilotExplainMatchRequest,
    request: Request,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> CopilotResponse:
    enforce_copilot_rate_limit(request)
    return explain_match(db, payload.opportunity_id)
