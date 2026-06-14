"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import {
  AlertTriangle,
  Bot,
  ChevronRight,
  History,
  Loader2,
  Menu,
  Mic2,
  MessageSquarePlus,
  Pause,
  Play,
  SendHorizontal,
  Sparkles,
  StopCircle,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { OpportunityCard } from "@/components/opportunity-card";
import { CopilotOpportunityMiniCard } from "@/components/copilot-opportunity-mini-card";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useVoiceOutput } from "@/hooks/use-voice-output";
import type {
  CopilotChatCitation,
  CopilotConversationDetail,
  CopilotConversationListItem,
  CopilotMessage,
  CopilotSuggestedFollowUp,
  OpportunityType,
  PublishedOpportunityCard,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const PROMPTS = [
  { bn: "SSC পাসে কোন দেশে কাজ পাবো?", en: "Which countries hire SSC-pass workers?" },
  { bn: "ড্রাইভিং চাকরির জন্য কী লাগবে?", en: "What is needed for a driving job?" },
  { bn: "সৌদি যেতে কী কী কাগজ লাগে?", en: "What documents are needed to go to Saudi Arabia?" },
  { bn: "বাংলাদেশ থেকে আবেদন করা যায় এমন চাকরি দেখান", en: "Show me jobs that can be applied for from Bangladesh" },
  { bn: "কোন চাকরিটা আমার জন্য ভালো?", en: "Which job is good for me?" },
];

type Locale = "bn" | "en";
type EntryMode = "voice" | "text";

type TimelineMessage = CopilotMessage & {
  tempKey?: string;
  pending?: boolean;
  failed?: boolean;
};

type ActiveConversation = Omit<CopilotConversationDetail, "messages"> & {
  messages: TimelineMessage[];
};

type StreamEvent =
  | { event: "start"; data: { conversation_id: number } }
  | { event: "token"; data: { text: string } }
  | { event: "citations"; data: { items: CopilotChatCitation[] } }
  | { event: "recommendations"; data: { items: CopilotChatCitation[] } }
  | { event: "done"; data: { message_id: number; assistant?: CopilotMessage } }
  | { event: "error"; data: { detail: string } };

interface SudokkhoChatShellProps {
  initialQuestion?: string;
  initialLocale?: Locale;
  initialMode?: EntryMode;
  initialAutoSpeak?: boolean;
}

function nowIso() {
  return new Date().toISOString();
}

function tempMessage(role: "user" | "assistant", content: string, extra: Partial<TimelineMessage> = {}): TimelineMessage {
  return {
    id: -Math.floor(Math.random() * 1_000_000),
    role,
    content,
    citations: [],
    suggested_follow_ups: [],
    created_at: nowIso(),
    ...extra,
  };
}

function errorText(payload: unknown, fallback: string): string {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    return typeof detail === "string" ? detail : fallback;
  }
  return fallback;
}

function citationToCard(citation: CopilotChatCitation): PublishedOpportunityCard {
  return {
    id: citation.opportunity_id,
    title: citation.title,
    title_bn: citation.title_bn,
    title_en: citation.title_en,
    opportunity_type: citation.opportunity_type as OpportunityType | null,
    country: citation.country,
    destination_country: citation.destination_country,
    employer_or_organization: citation.employer_or_organization,
    sector: null,
    isc_category_key: null,
    platform_category_bn: null,
    platform_category_en: null,
    salary_min: citation.salary_min,
    salary_max: citation.salary_max,
    salary_currency: citation.salary_currency,
    salary_text: citation.salary_text,
    salary_text_bn: citation.salary_text_bn,
    salary_text_en: null,
    experience_min_years: citation.experience_min_years ?? null,
    deadline: citation.deadline,
    source_page_url: citation.source_url,
    document_url: null,
    original_apply_url: null,
    content_type: null,
    source_name: null,
    source_trust_badge: citation.source_trust_badge,
    can_apply_from_bd: citation.can_apply_from_bd,
    requires_existing_work_permit: null,
    open_to_international_candidates: null,
    open_to_authorized_workers_only: null,
    lmia_status: null,
    eligibility_status: null,
    target_audience_tags: [],
    risk_flags: [],
    trust_score: 0,
    bangladesh_applicability: null,
    rural_user_fit_score: 0,
    actionability_score: 0,
    overall_rank_score: 0,
    published_at: null,
    is_saved: citation.is_saved,
    why_this_matches: citation.why_this_matches,
    summary: citation.summary,
    summary_bn: citation.summary_bn,
    source_url: citation.source_url,
    is_active: true,
  };
}

function formatMessageTime(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatConversationTime(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function parseStreamBlock(block: string): StreamEvent | null {
  const eventLine = block.split("\n").find((line) => line.startsWith("event:"));
  const dataLines = block.split("\n").filter((line) => line.startsWith("data:"));
  const event = eventLine?.replace("event:", "").trim() as StreamEvent["event"] | undefined;
  const rawData = dataLines.map((line) => line.replace("data:", "").trim()).join("\n");
  if (!event || !rawData) {
    return null;
  }
  try {
    return { event, data: JSON.parse(rawData) } as StreamEvent;
  } catch {
    return null;
  }
}

async function readSse(
  response: Response,
  onEvent: (event: StreamEvent) => void,
) {
  if (!response.body) {
    throw new Error("No stream body");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const event = parseStreamBlock(part.trim());
      if (event) {
        onEvent(event);
      }
    }
  }
  if (buffer.trim()) {
    const event = parseStreamBlock(buffer.trim());
    if (event) {
      onEvent(event);
    }
  }
}

export function SudokkhoChatShell({
  initialQuestion = "",
  initialLocale = "bn",
  initialMode = "text",
  initialAutoSpeak = false,
}: SudokkhoChatShellProps) {
  const currentLocale = useLocale() as Locale;
  const locale = currentLocale === "en" ? "en" : initialLocale;
  const isEn = locale === "en";
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const initialSendKeyRef = useRef("");
  const streamAbortRef = useRef<AbortController | null>(null);
  const voice = useVoiceOutput(locale);

  const [composer, setComposer] = useState(initialQuestion);
  const [conversations, setConversations] = useState<CopilotConversationListItem[]>([]);
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [openingConversationId, setOpeningConversationId] = useState<number | null>(null);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [pageError, setPageError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [voiceQuestionReceived, setVoiceQuestionReceived] = useState(initialMode === "voice" && Boolean(initialQuestion.trim()));
  const [lastFailedQuestion, setLastFailedQuestion] = useState("");

  useEffect(() => {
    if (initialAutoSpeak) {
      voice.setEnabled(true);
    }
  }, [initialAutoSpeak, voice]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeConversation?.messages, sending]);

  const openConversation = useCallback(async (conversationId: number) => {
    setOpeningConversationId(conversationId);
    setPageError("");
    try {
      const response = await fetch(`/api/copilot/conversations/${conversationId}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPageError(errorText(payload, isEn ? "Could not open this chat." : "এই চ্যাট খোলা যায়নি।"));
        return;
      }
      setActiveConversation(payload as ActiveConversation);
      setSidebarOpen(false);
      voice.stop();
    } finally {
      setOpeningConversationId(null);
    }
  }, [isEn, voice]);

  const loadConversationList = useCallback(async (options?: { preferredConversationId?: number; autoOpenFirst?: boolean }) => {
    setLoadingHistory(true);
    try {
      const response = await fetch("/api/copilot/conversations", { cache: "no-store" });
      const payload = await response.json().catch(() => []);
      if (!response.ok) {
        setPageError(errorText(payload, isEn ? "Could not load chat history." : "চ্যাট ইতিহাস লোড করা যায়নি।"));
        return;
      }
      const items = Array.isArray(payload) ? payload as CopilotConversationListItem[] : [];
      setConversations(items);
      if (options?.preferredConversationId && items.some((item) => item.id === options.preferredConversationId)) {
        await openConversation(options.preferredConversationId);
      } else if (options?.autoOpenFirst !== false && !activeConversation && items.length > 0) {
        await openConversation(items[0].id);
      } else if (items.length === 0) {
        setActiveConversation(null);
      }
    } finally {
      setLoadingHistory(false);
    }
  }, [activeConversation, isEn, openConversation]);

  const createConversation = useCallback(async () => {
    setCreatingConversation(true);
    setPageError("");
    try {
      const response = await fetch("/api/copilot/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPageError(errorText(payload, isEn ? "Could not start a new chat." : "নতুন চ্যাট শুরু করা যায়নি।"));
        return null;
      }
      const conversation = payload as ActiveConversation;
      setActiveConversation(conversation);
      setConversations((current) => [
        {
          id: conversation.id,
          title: conversation.title,
          locale: conversation.locale,
          last_message_preview: null,
          updated_at: conversation.updated_at,
          last_message_at: conversation.last_message_at,
        },
        ...current.filter((item) => item.id !== conversation.id),
      ]);
      setSidebarOpen(false);
      voice.stop();
      return conversation;
    } finally {
      setCreatingConversation(false);
    }
  }, [isEn, locale, voice]);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const question = (overrideText ?? composer).trim();
    if (!question || sending) {
      return;
    }

    setPageError("");
    setLastFailedQuestion("");
    setComposer("");
    setSending(true);
    voice.stop();

    let conversation = activeConversation;
    if (!conversation) {
      conversation = await createConversation();
      if (!conversation) {
        setComposer(question);
        setSending(false);
        return;
      }
    }

    const userTemp = tempMessage("user", question, { tempKey: `user-${Date.now()}` });
    const assistantTemp = tempMessage("assistant", "", {
      tempKey: `assistant-${Date.now()}`,
      pending: true,
    });

    setActiveConversation((current) => {
      if (!current || current.id !== conversation.id) return current;
      return { ...current, messages: [...current.messages, userTemp, assistantTemp] };
    });
    setConversations((current) => [
      {
        id: conversation.id,
        title: conversation.title,
        locale: conversation.locale,
        last_message_preview: question,
        updated_at: nowIso(),
        last_message_at: nowIso(),
      },
      ...current.filter((item) => item.id !== conversation.id),
    ]);

    const abortController = new AbortController();
    streamAbortRef.current = abortController;
    let streamedContent = "";
    let latestCitations: CopilotChatCitation[] = [];

    try {
      const response = await fetch(`/api/copilot/conversations/${conversation.id}/messages/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, locale }),
        signal: abortController.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(errorText(payload, isEn ? "Could not get an answer." : "উত্তর পাওয়া যায়নি।"));
      }

      await readSse(response, (event) => {
        if (event.event === "token") {
          streamedContent += event.data.text;
          setActiveConversation((current) => {
            if (!current || current.id !== conversation.id) return current;
            return {
              ...current,
              messages: current.messages.map((message) =>
                message.tempKey === assistantTemp.tempKey
                  ? { ...message, content: streamedContent, pending: true }
                  : message,
              ),
            };
          });
        }
        if (event.event === "citations" || event.event === "recommendations") {
          latestCitations = event.data.items;
          setActiveConversation((current) => {
            if (!current || current.id !== conversation.id) return current;
            return {
              ...current,
              messages: current.messages.map((message) =>
                message.tempKey === assistantTemp.tempKey
                  ? { ...message, citations: latestCitations }
                  : message,
              ),
            };
          });
        }
        if (event.event === "done") {
          const finalAssistant = event.data.assistant;
          setActiveConversation((current) => {
            if (!current || current.id !== conversation.id) return current;
            return {
              ...current,
              messages: current.messages.map((message) =>
                message.tempKey === assistantTemp.tempKey
                  ? {
                      ...(finalAssistant ?? message),
                      id: event.data.message_id,
                      content: finalAssistant?.content ?? streamedContent,
                      citations: finalAssistant?.citations ?? latestCitations,
                      suggested_follow_ups: finalAssistant?.suggested_follow_ups ?? message.suggested_follow_ups,
                      pending: false,
                    }
                  : message,
              ),
            };
          });
        }
        if (event.event === "error") {
          throw new Error(event.data.detail);
        }
      });

      if (voice.enabled && streamedContent.trim()) {
        const textToSpeak = getShortAnswerForSpeech(streamedContent);
        if (textToSpeak) {
          await voice.speak(textToSpeak);
        }
      }
      await loadConversationList({ preferredConversationId: conversation.id, autoOpenFirst: false });
    } catch (error) {
      if (abortController.signal.aborted) {
        setPageError(isEn ? "Generation stopped." : "উত্তর তৈরি বন্ধ করা হয়েছে।");
      } else {
        const message = error instanceof Error ? error.message : isEn ? "Could not get an answer." : "উত্তর পাওয়া যায়নি।";
        setPageError(message);
        setLastFailedQuestion(question);
      }
      setActiveConversation((current) => {
        if (!current || current.id !== conversation.id) return current;
        return {
          ...current,
          messages: current.messages.map((item) =>
            item.tempKey === assistantTemp.tempKey
              ? { ...item, content: item.content || (isEn ? "Answer failed." : "উত্তর পাওয়া যায়নি।"), pending: false, failed: true }
              : item,
          ),
        };
      });
    } finally {
      setSending(false);
      streamAbortRef.current = null;
      setVoiceQuestionReceived(false);
    }
  }, [activeConversation, composer, createConversation, isEn, loadConversationList, locale, sending, voice]);

  const deleteConversation = async (conversationId: number) => {
    const response = await fetch(`/api/copilot/conversations/${conversationId}`, { method: "DELETE" });
    if (!response.ok) {
      setPageError(isEn ? "Could not delete this chat." : "চ্যাট মুছতে সমস্যা হয়েছে।");
      return;
    }
    setConversations((current) => current.filter((item) => item.id !== conversationId));
    setActiveConversation(null);
    await loadConversationList();
  };

  useEffect(() => {
    void loadConversationList({ autoOpenFirst: !initialQuestion.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const clean = initialQuestion.trim();
    if (!clean || initialSendKeyRef.current === clean || !activeConversation || activeConversation.messages.length > 0) {
      return;
    }
    initialSendKeyRef.current = clean;
    void sendMessage(clean);
  }, [activeConversation, initialQuestion, sendMessage]);

  const latestAssistant = useMemo(() => {
    return [...(activeConversation?.messages ?? [])].reverse().find((message) => message.role === "assistant") ?? null;
  }, [activeConversation]);

  const stopGenerating = () => {
    streamAbortRef.current?.abort();
  };

  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden bg-slate-50 text-slate-950 dark:bg-slate-900 dark:text-slate-50">
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white md:block">
        <ChatHistorySidebar
          conversations={conversations}
          activeConversationId={activeConversation?.id ?? null}
          loading={loadingHistory}
          creating={creatingConversation}
          openingConversationId={openingConversationId}
          locale={locale}
          isEn={isEn}
          onOpen={openConversation}
          onCreate={createConversation}
        />
      </aside>

      <MobileDrawer
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        activeConversationId={activeConversation?.id ?? null}
        loading={loadingHistory}
        creating={creatingConversation}
        openingConversationId={openingConversationId}
        locale={locale}
        isEn={isEn}
        onOpen={openConversation}
        onCreate={createConversation}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label={isEn ? "Open history" : "ইতিহাস খুলুন"}
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-100">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
                <Bot className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-bold">{isEn ? "Sudokkho AI" : "সুদক্ষ AI"}</span>
                <span className="block text-[10px] text-slate-500 sm:text-xs max-w-[180px] sm:max-w-[400px] md:max-w-none truncate">
                  {isEn 
                    ? "Ask about jobs, countries, costs, documents, or safe application steps." 
                    : "চাকরি, দেশ, খরচ, কাগজপত্র বা নিরাপদ আবেদন নিয়ে প্রশ্ন করুন।"}
                </span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => voice.setEnabled(!voice.enabled)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300",
                voice.enabled ? "border-teal-300 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-600",
              )}
              aria-label={voice.enabled ? (isEn ? "Turn voice output off" : "ভয়েস বন্ধ করুন") : (isEn ? "Turn voice output on" : "ভয়েস চালু করুন")}
            >
              {voice.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              <span className="hidden sm:inline">{voice.enabled ? (isEn ? "Voice on" : "ভয়েস চালু") : (isEn ? "Voice off" : "ভয়েস বন্ধ")}</span>
            </button>
            {activeConversation ? (
              <button
                type="button"
                onClick={() => void deleteConversation(activeConversation.id)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-rose-600 hover:bg-rose-50"
                aria-label={isEn ? "Delete chat" : "চ্যাট মুছুন"}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </header>

        <section className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto max-w-4xl space-y-6">
            {voiceQuestionReceived ? (
              <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">
                {isEn ? "Voice question received. Sudokkho AI is preparing your answer." : "ভয়েস প্রশ্ন পাওয়া গেছে। সুদক্ষ AI উত্তর তৈরি করছে।"}
              </div>
            ) : null}
            {!activeConversation || activeConversation.messages.length === 0 ? (
              <EmptyState isEn={isEn} onPrompt={(text) => void sendMessage(text)} />
            ) : (
              activeConversation.messages.map((message) => (
                <ChatMessageBubble
                  key={message.tempKey ?? message.id}
                  message={message}
                  locale={locale}
                  isEn={isEn}
                  isSpeaking={voice.speakingMessageId === message.id}
                  voiceStatus={voice.status}
                  onSpeak={() => void voice.speak(message.content, { messageId: message.id })}
                  onPause={voice.pause}
                  onResume={voice.resume}
                  onStop={voice.stop}
                  onFollowUp={(text) => void sendMessage(text)}
                />
              ))
            )}
            <div ref={bottomRef} className="h-2" />
          </div>
        </section>

        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 md:px-8">
          <div className="mx-auto max-w-4xl space-y-3">
            {pageError ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {pageError}
                </span>
                {lastFailedQuestion ? (
                  <button type="button" className="font-bold text-amber-900 underline" onClick={() => void sendMessage(lastFailedQuestion)}>
                    {isEn ? "Retry" : "আবার চেষ্টা করুন"}
                  </button>
                ) : null}
              </div>
            ) : null}
            <VoiceComposer
              value={composer}
              onChange={setComposer}
              onSend={() => void sendMessage()}
              disabled={sending || creatingConversation}
              streaming={sending}
              onStopGenerating={stopGenerating}
              locale={locale}
              isEn={isEn}
            />
            <p className="text-center text-[11px] text-slate-500">
              {isEn ? "Check important information before applying." : "গুরুত্বপূর্ণ তথ্য আবেদন করার আগে যাচাই করুন।"}
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

interface SidebarProps {
  conversations: CopilotConversationListItem[];
  activeConversationId: number | null;
  loading: boolean;
  creating: boolean;
  openingConversationId: number | null;
  locale: Locale;
  isEn: boolean;
  onOpen: (id: number) => Promise<void>;
  onCreate: () => Promise<ActiveConversation | null>;
}

function ChatHistorySidebar({
  conversations,
  activeConversationId,
  loading,
  creating,
  openingConversationId,
  locale,
  isEn,
  onOpen,
  onCreate,
}: SidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-3">
        <button
          type="button"
          onClick={() => void onCreate()}
          disabled={creating}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-60"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
          {isEn ? "New chat" : "নতুন চ্যাট"}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-2 flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-wide text-slate-400">
          <History className="h-3.5 w-3.5" />
          {isEn ? "History" : "ইতিহাস"}
        </div>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-slate-500">{isEn ? "No chats yet" : "এখনো কোনো চ্যাট নেই"}</p>
        ) : (
          <div className="space-y-1">
            {conversations.map((conversation) => (
              <button
                type="button"
                key={conversation.id}
                onClick={() => void onOpen(conversation.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm transition",
                  activeConversationId === conversation.id ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-100",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold">{conversation.title}</span>
                  <span className="block truncate text-xs opacity-60">{formatConversationTime(conversation.last_message_at, locale)}</span>
                </span>
                {openingConversationId === conversation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MobileDrawer({ open, onClose, ...props }: SidebarProps & { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-950/50" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 w-80 max-w-[88vw] bg-white shadow-2xl">
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
          <span className="font-bold">{props.isEn ? "Chat history" : "চ্যাট ইতিহাস"}</span>
          <button type="button" onClick={onClose} aria-label={props.isEn ? "Close" : "বন্ধ করুন"} className="rounded-xl p-2 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <ChatHistorySidebar {...props} />
      </div>
    </div>
  );
}

interface BubbleProps {
  message: TimelineMessage;
  locale: Locale;
  isEn: boolean;
  isSpeaking: boolean;
  voiceStatus: "idle" | "loading" | "speaking" | "paused";
  onSpeak: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onFollowUp: (text: string) => void;
}

interface StructuredSections {
  shortAnswer: string;
  whyMatch: string;
  safety: string;
  nextSteps: string;
}

function parseStructuredAnswer(content: string): StructuredSections {
  const sections: StructuredSections = {
    shortAnswer: "",
    whyMatch: "",
    safety: "",
    nextSteps: "",
  };

  const hasTags = content.includes("[SHORT_ANSWER]") || 
                  content.includes("[WHY_MATCH]") || 
                  content.includes("[SAFETY]") || 
                  content.includes("[NEXT_STEPS]");

  if (!hasTags) {
    sections.shortAnswer = content;
    return sections;
  }

  const tags = [
    { tag: "[SHORT_ANSWER]", key: "shortAnswer" },
    { tag: "[WHY_MATCH]", key: "whyMatch" },
    { tag: "[SAFETY]", key: "safety" },
    { tag: "[NEXT_STEPS]", key: "nextSteps" },
  ] as const;

  const matches: { index: number; tag: string; key: keyof StructuredSections }[] = [];
  for (const t of tags) {
    let pos = content.indexOf(t.tag);
    while (pos !== -1) {
      matches.push({ index: pos, tag: t.tag, key: t.key });
      pos = content.indexOf(t.tag, pos + 1);
    }
  }

  matches.sort((a, b) => a.index - b.index);

  if (matches.length === 0) {
    sections.shortAnswer = content;
    return sections;
  }

  if (matches[0].index > 0) {
    sections.shortAnswer = content.substring(0, matches[0].index).trim();
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const start = current.index + current.tag.length;
    const end = next ? next.index : content.length;
    const text = content.substring(start, end).trim();
    sections[current.key] = text;
  }

  return sections;
}

function getShortAnswerForSpeech(content: string): string {
  if (content.includes("[SHORT_ANSWER]")) {
    const start = content.indexOf("[SHORT_ANSWER]") + "[SHORT_ANSWER]".length;
    let end = content.length;
    const nextTags = ["[WHY_MATCH]", "[SAFETY]", "[NEXT_STEPS]"];
    for (const tag of nextTags) {
      const pos = content.indexOf(tag);
      if (pos !== -1 && pos < end) {
        end = pos;
      }
    }
    content = content.substring(start, end);
  } else {
    const firstTags = ["[WHY_MATCH]", "[SAFETY]", "[NEXT_STEPS]"];
    let end = content.length;
    for (const tag of firstTags) {
      const pos = content.indexOf(tag);
      if (pos !== -1 && pos < end) {
        end = pos;
      }
    }
    content = content.substring(0, end);
  }

  return content
    .replace(/\[#\d+\]/g, "")
    .replace(/[*#_`~]/g, "")
    .trim();
}

function ChatMessageBubble({
  message,
  locale,
  isEn,
  isSpeaking,
  voiceStatus,
  onSpeak,
  onPause,
  onResume,
  onStop,
  onFollowUp,
}: BubbleProps) {
  const assistant = message.role === "assistant";
  const citations = message.citations ?? [];
  
  const followUps = message.suggested_follow_ups && message.suggested_follow_ups.length > 0 
    ? message.suggested_follow_ups 
    : (isEn 
        ? [
            { text: "What documents are needed for this job?" },
            { text: "Can I apply from Bangladesh?" },
            { text: "Which job is safer?" },
            { text: "Show jobs with salary mentioned" },
            { text: "Show jobs with deadline closing soon" },
          ]
        : [
            { text: "এই চাকরির জন্য কী কাগজ লাগবে?" },
            { text: "বাংলাদেশ থেকে আবেদন করা যাবে?" },
            { text: "কোন চাকরিটা বেশি নিরাপদ?" },
            { text: "বেতন উল্লেখ আছে এমন চাকরি দেখান" },
            { text: "শেষ তারিখ কাছের চাকরি দেখান" },
          ]
      );

  const [showAllCitations, setShowAllCitations] = useState(false);
  const sections = parseStructuredAnswer(message.content);

  const hasUnknown = message.content.toLowerCase().includes("unknown") || 
                     message.content.includes("স্পষ্ট নেই") || 
                     message.content.includes("অজানা") ||
                     citations.some(c => !c.deadline || c.salary_min === null || !c.salary_text);

  return (
    <article className={cn("flex w-full", assistant ? "justify-start" : "justify-end")}>
      <div className={cn("max-w-[95%] space-y-3 md:max-w-[85%]", assistant ? "w-full" : "")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3.5 shadow-sm",
            assistant
              ? message.failed
                ? "border border-rose-200 bg-rose-50 text-rose-800"
                : "border border-slate-200 bg-white text-slate-900"
              : "bg-teal-600 text-white",
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-3 text-xs opacity-70">
            <span className="inline-flex items-center gap-1 font-bold">
              {assistant ? <Sparkles className="h-3.5 w-3.5" /> : null}
              {assistant ? (isEn ? "Sudokkho AI" : "সুদক্ষ AI") : isEn ? "You" : "আপনি"}
            </span>
            <span>{formatMessageTime(message.created_at, locale)}</span>
          </div>

          {assistant ? (
            <div className="space-y-4">
              {/* 1. Short Answer */}
              <div className="space-y-1">
                <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  {isEn ? "Short Answer" : "সংক্ষিপ্ত উত্তর"}
                </h5>
                <div className="whitespace-pre-wrap text-sm leading-relaxed md:text-base font-bold text-slate-800">
                  {sections.shortAnswer || (message.pending ? (isEn ? "Thinking..." : "ভাবছি...") : "")}
                </div>
              </div>

              {/* 2. Related Opportunities */}
              {!message.pending && citations.length > 0 && (
                <div className="space-y-2 pt-1">
                  <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    {isEn ? "Matching Opportunities" : "মিল পাওয়া সুযোগ"}
                  </h5>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {citations.slice(0, showAllCitations ? citations.length : 3).map((citation) => (
                      <CopilotOpportunityMiniCard
                        key={citation.opportunity_id}
                        item={citation}
                      />
                    ))}
                  </div>
                  {citations.length > 3 && !showAllCitations && (
                    <button
                      type="button"
                      onClick={() => setShowAllCitations(true)}
                      className="w-full text-center py-2 text-xs font-bold text-teal-600 hover:text-teal-700 bg-teal-50/50 rounded-xl transition border border-teal-150 hover:bg-teal-50 min-h-[44px]"
                    >
                      {isEn ? "View more" : "আরও দেখুন"} ({citations.length - 3})
                    </button>
                  )}
                </div>
              )}

              {/* 3. Why Match */}
              {!message.pending && sections.whyMatch && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-1">
                  <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    {isEn ? "Why these match" : "কেন এগুলো মিলেছে"}
                  </h5>
                  <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-medium">
                    {sections.whyMatch}
                  </div>
                </div>
              )}

              {/* 4. Safety Note */}
              {!message.pending && !message.failed && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-1">
                  <h5 className="text-[11px] font-black uppercase tracking-wider text-amber-800">
                    {isEn ? "Safety Note" : "সতর্কতা"}
                  </h5>
                  <p className="text-xs sm:text-sm text-amber-950 font-bold leading-relaxed">
                    {isEn 
                      ? "Before paying money or sharing personal documents, verify the official source and employer." 
                      : "টাকা বা ব্যক্তিগত কাগজ দেওয়ার আগে অফিসিয়াল উৎস ও নিয়োগকারী যাচাই করুন।"}
                  </p>
                  {(hasUnknown || sections.safety) && (
                    <div className="text-xs text-amber-700 leading-relaxed border-t border-amber-200/40 pt-1 mt-1 font-medium">
                      {sections.safety ? sections.safety : (
                        isEn 
                          ? "Some information is not clear in the source — verify before applying." 
                          : "কিছু তথ্য উৎসে স্পষ্ট নেই — আবেদন করার আগে যাচাই করুন।"
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 5. Next Steps */}
              {!message.pending && sections.nextSteps && (
                <div className="rounded-xl border border-teal-100 bg-teal-50/20 p-3 space-y-1">
                  <h5 className="text-[11px] font-black uppercase tracking-wider text-teal-800">
                    {isEn ? "Next steps" : "এরপর কী করবেন"}
                  </h5>
                  <div className="whitespace-pre-wrap text-sm text-teal-900 leading-relaxed font-bold">
                    {sections.nextSteps}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-7 md:text-base font-bold">
              {message.content}
            </div>
          )}

          {message.pending ? (
            <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-teal-700">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {isEn ? "Searching verified opportunities..." : "যাচাই করা তথ্য খোঁজা হচ্ছে..."}
            </div>
          ) : null}

          {assistant && !message.pending && !message.failed ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              {isSpeaking ? (
                <>
                  <button type="button" onClick={voiceStatus === "paused" ? onResume : onPause} className="inline-flex h-10 items-center gap-1 rounded-lg bg-teal-50 px-3 text-xs font-bold text-teal-700 min-h-[44px]">
                    {voiceStatus === "paused" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                    {voiceStatus === "paused" ? (isEn ? "Resume" : "চালান") : (isEn ? "Pause" : "থামান")}
                  </button>
                  <button type="button" onClick={onStop} className="inline-flex h-10 items-center gap-1 rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-700 min-h-[44px]">
                    <StopCircle className="h-3.5 w-3.5" />
                    {isEn ? "Stop" : "বন্ধ"}
                  </button>
                </>
              ) : (
                <button type="button" onClick={onSpeak} className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:border-teal-300 hover:text-teal-750 min-h-[44px]">
                  <Volume2 className="h-3.5 w-3.5" />
                  {isEn ? "Listen" : "শুনুন"}
                </button>
              )}
            </div>
          ) : null}
        </div>

        {assistant && !message.pending && followUps.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {followUps.map((item) => (
              <SuggestedPrompt key={item.text} item={item} onClick={() => onFollowUp(item.text)} />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function SuggestedPrompt({ item, onClick }: { item: CopilotSuggestedFollowUp; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:border-teal-300 hover:text-teal-750 min-h-[44px] inline-flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
    >
      {item.text}
    </button>
  );
}

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  streaming: boolean;
  onStopGenerating: () => void;
  locale: Locale;
  isEn: boolean;
}

function VoiceComposer({ value, onChange, onSend, disabled, streaming, onStopGenerating, locale, isEn }: ComposerProps) {
  const speech = useSpeechRecognition(locale);

  useEffect(() => {
    if (speech.transcript) {
      onChange(speech.transcript);
    }
  }, [onChange, speech.transcript]);

  const toggleVoice = () => {
    if (speech.isListening) {
      speech.stopListening();
      return;
    }
    speech.resetTranscript();
    onChange("");
    speech.startListening();
  };

  const voiceError = speech.error && speech.error !== "no-speech"
    ? isEn
      ? "Voice input is unavailable. You can type your question."
      : "ভয়েস চালু হয়নি। আপনি প্রশ্ন লিখেও পাঠাতে পারেন।"
    : "";

  let statusText = "";
  if (speech.isListening) {
    statusText = isEn ? "Listening - please speak..." : "মাইক চালু আছে - কথা বলুন...";
  } else if (disabled || streaming) {
    statusText = isEn ? "Sending..." : "পাঠানো হচ্ছে...";
  } else if (voiceError) {
    statusText = voiceError;
  } else if (speech.transcript && !speech.isListening) {
    statusText = isEn ? "Transcript ready. You can edit and send." : "ভয়েস রেকর্ড হয়েছে। আপনি এটি পরিবর্তন করে পাঠাতে পারেন।";
  }

  return (
    <div className="space-y-2">
      {statusText ? (
        <div className={cn(
          "flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs font-semibold",
          speech.isListening 
            ? "border-teal-200 bg-teal-50 text-teal-800"
            : voiceError 
              ? "border-rose-200 bg-rose-50 text-rose-805"
              : "border-slate-200 bg-slate-50 text-slate-700"
        )}>
          <span className="inline-flex items-center gap-2">
            {speech.isListening && <span className="h-2 w-2 animate-ping rounded-full bg-teal-600" />}
            <span>{statusText}</span>
          </span>
          {speech.isListening && (
            <button type="button" onClick={() => { speech.abortListening(); speech.resetTranscript(); onChange(""); }} aria-label={isEn ? "Clear transcript" : "ট্রান্সক্রিপ্ট মুছুন"}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : null}

      <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg focus-within:border-teal-400 focus-within:ring-4 focus-within:ring-teal-100">
        <button
          type="button"
          onClick={toggleVoice}
          disabled={disabled}
          aria-label={speech.isListening ? (isEn ? "Stop listening" : "শোনা বন্ধ করুন") : (isEn ? "Start voice input" : "ভয়েস ইনপুট শুরু করুন")}
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white transition disabled:opacity-50 min-h-[44px]",
            speech.isListening ? "bg-rose-600" : "bg-teal-600 hover:bg-teal-700",
          )}
        >
          {speech.isListening ? <span className="h-4 w-4 rounded-full bg-white" /> : <Mic2 className="h-6 w-6" />}
        </button>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          rows={1}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder={isEn ? "Ask about overseas jobs, costs, documents..." : "বিদেশের চাকরি, খরচ, কাগজপত্র নিয়ে প্রশ্ন করুন..."}
          className="max-h-36 min-h-14 flex-1 resize-none bg-transparent px-2 py-4 text-sm font-medium outline-none placeholder:text-slate-400 md:text-base"
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStopGenerating}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white min-h-[44px]"
            aria-label={isEn ? "Stop generating" : "উত্তর তৈরি বন্ধ করুন"}
          >
            <StopCircle className="h-6 w-6" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={disabled || !value.trim()}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-navy text-white transition hover:bg-slate-800 disabled:bg-slate-300 min-h-[44px]"
            aria-label={isEn ? "Send message" : "বার্তা পাঠান"}
          >
            {disabled ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-6 w-6" />}
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ isEn, onPrompt }: { isEn: boolean; onPrompt: (text: string) => void }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center py-10 text-center md:py-16">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-lg">
        <Sparkles className="h-9 w-9" />
      </div>
      <h1 className="mt-6 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
        {isEn ? "What do you want to know?" : "কী জানতে চান?"}
      </h1>
      <p className="mt-3 max-w-xl text-base text-slate-600">
        {isEn ? "Ask, speak by voice, and find verified opportunities." : "প্রশ্ন করুন, ভয়েসে বলুন, যাচাই করা সুযোগ খুঁজুন।"}
      </p>
      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        {PROMPTS.map((prompt) => {
          const text = isEn ? prompt.en : prompt.bn;
          return (
            <button
              key={prompt.en}
              type="button"
              onClick={() => onPrompt(text)}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm font-bold text-slate-800 shadow-sm hover:border-teal-300 hover:text-teal-700 min-h-[44px]"
            >
              <span>{text}</span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </button>
          );
        })}
      </div>
      <p className="mt-6 text-xs font-medium text-slate-500">
        {isEn ? "Sudokkho AI helps only from verified indexed information." : "সুদক্ষ AI শুধু যাচাই করা তথ্যের ভিত্তিতে সাহায্য করে।"}
      </p>
    </div>
  );
}
