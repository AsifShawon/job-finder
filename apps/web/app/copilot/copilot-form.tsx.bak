"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import {
  AlertTriangle,
  Loader2,
  Menu,
  MessageSquarePlus,
  Mic2,
  PanelLeftClose,
  SendHorizontal,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { MiniVoiceButton } from "@/components/mini-voice-button";
import { OpportunityCard } from "@/components/opportunity-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  CopilotChatCitation,
  CopilotConversationDetail,
  CopilotConversationListItem,
  CopilotMessage,
  CopilotSuggestedFollowUp,
  OpportunityType,
  PublishedOpportunityCard,
} from "@/lib/types";

const BILINGUAL_PROMPTS = [
  { bn: "কানাডায় নার্স হিসেবে কাজ করতে কী লাগবে?", en: "What's needed to work as a nurse in Canada?" },
  { bn: "SSC পাসে কোন দেশে কাজ পাবো?", en: "Which countries hire SSC-pass workers?" },
  { bn: "জার্মানি Ausbildung-এ আবেদন কীভাবে করবো?", en: "How do I apply for German Ausbildung?" },
  { bn: "মালয়েশিয়া যেতে কত খরচ লাগে?", en: "How much does it cost to go to Malaysia?" },
  { bn: "সরকারি বৃত্তির জন্য কীভাবে আবেদন করবো?", en: "How do I apply for government scholarships?" },
  { bn: "দুবাইয়ে ড্রাইভিং চাকরির জন্য কী করতে হবে?", en: "What to do for a driving job in Dubai?" },
];

type TimelineMessage = CopilotMessage & {
  tempKey?: string;
  pending?: boolean;
  failed?: boolean;
};

type ActiveConversation = Omit<CopilotConversationDetail, "messages"> & {
  messages: TimelineMessage[];
};

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (Array.isArray(payload)) {
    const parts = payload
      .map((entry) => getErrorMessage(entry, ""))
      .filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : fallback;
  }
  if (typeof payload === "object") {
    const detail = (payload as { detail?: unknown }).detail;
    if (detail !== undefined) return getErrorMessage(detail, fallback);
    const msg = (payload as { msg?: unknown }).msg;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return fallback;
}

function citationToCard(c: CopilotChatCitation): PublishedOpportunityCard {
  return {
    id: c.opportunity_id,
    title: c.title,
    title_bn: c.title_bn,
    title_en: c.title_en,
    opportunity_type: c.opportunity_type as OpportunityType | null,
    country: c.country,
    destination_country: c.destination_country,
    employer_or_organization: c.employer_or_organization,
    sector: null,
    salary_min: c.salary_min,
    salary_max: c.salary_max,
    salary_currency: c.salary_currency,
    salary_text: c.salary_text,
    salary_text_bn: c.salary_text_bn,
    salary_text_en: null,
    deadline: c.deadline,
    source_page_url: c.source_url,
    document_url: null,
    original_apply_url: null,
    content_type: null,
    source_name: null,
    source_trust_badge: c.source_trust_badge,
    can_apply_from_bd: c.can_apply_from_bd,
    requires_existing_work_permit: null,
    open_to_international_candidates: null,
    open_to_authorized_workers_only: null,
    lmia_status: null,
    eligibility_status: null,
    target_audience_tags: [],
    risk_flags: [],
    trust_score: 0,
    overall_rank_score: 0,
    published_at: null,
    is_saved: c.is_saved,
    why_this_matches: c.why_this_matches,
    summary: c.summary,
    summary_bn: c.summary_bn,
    source_url: c.source_url,
    is_active: true,
  };
}

function formatConversationTime(value: string, locale: "bn" | "en"): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatMessageTime(value: string, locale: "bn" | "en"): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function buildTempMessage(
  role: "user" | "assistant",
  content: string,
  options: Partial<TimelineMessage> = {},
): TimelineMessage {
  return {
    id: -Math.floor(Math.random() * 1_000_000),
    role,
    content,
    citations: [],
    suggested_follow_ups: [],
    created_at: new Date().toISOString(),
    ...options,
  };
}

export function CopilotForm({
  initialQuestion = "",
  initialLocale = "bn",
}: {
  initialQuestion?: string;
  initialLocale?: "bn" | "en";
}) {
  const currentLocale = useLocale() as "bn" | "en";
  const locale = currentLocale === "en" ? "en" : initialLocale;
  const isEn = locale === "en";
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const autoPromptRef = useRef(false);

  const [composer, setComposer] = useState(initialQuestion);
  const [conversations, setConversations] = useState<CopilotConversationListItem[]>([]);
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [openingConversationId, setOpeningConversationId] = useState<number | null>(null);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState<number | null>(null);
  const [pageError, setPageError] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const latestAssistantMessage = useMemo(() => {
    if (!activeConversation) return null;
    const messages = [...activeConversation.messages].reverse();
    return messages.find((message) => message.role === "assistant") ?? null;
  }, [activeConversation]);

  const bottomSuggestions = useMemo(() => {
    if (!latestAssistantMessage) {
      return { followUps: [] as CopilotSuggestedFollowUp[], citations: [] as CopilotChatCitation[] };
    }
    return {
      followUps: latestAssistantMessage.suggested_follow_ups ?? [],
      citations: latestAssistantMessage.citations ?? [],
    };
  }, [latestAssistantMessage]);

  const loadConversationList = async (options?: { preferredConversationId?: number | null; autoOpenFirst?: boolean }) => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/copilot/conversations", { cache: "no-store" });
      const payload = (await res.json().catch(() => ([]))) as CopilotConversationListItem[] | { detail?: unknown };
      if (!res.ok) {
        setPageError(getErrorMessage(payload, isEn ? "Could not load chat history." : "চ্যাট হিস্টোরি লোড করা যায়নি।"));
        return;
      }
      const items = Array.isArray(payload) ? payload : [];
      setConversations(items);

      const preferred = options?.preferredConversationId;
      if (preferred) {
        const exists = items.some((item) => item.id === preferred);
        if (exists) {
          await openConversation(preferred);
          return;
        }
      }

      if (options?.autoOpenFirst !== false && !activeConversation && items.length > 0) {
        await openConversation(items[0].id);
      }
      if (items.length === 0) {
        setActiveConversation(null);
      }
    } finally {
      setLoadingHistory(false);
    }
  };

  const openConversation = async (conversationId: number) => {
    setOpeningConversationId(conversationId);
    setPageError("");
    try {
      const res = await fetch(`/api/copilot/conversations/${conversationId}`, { cache: "no-store" });
      const payload = (await res.json().catch(() => ({}))) as CopilotConversationDetail | { detail?: unknown };
      if (!res.ok) {
        setPageError(getErrorMessage(payload, isEn ? "Could not open this chat." : "এই চ্যাট খোলা যায়নি।"));
        return;
      }
      setActiveConversation(payload as ActiveConversation);
      setMobileSidebarOpen(false);
    } finally {
      setOpeningConversationId(null);
    }
  };

  const createConversation = async () => {
    setCreatingConversation(true);
    setPageError("");
    try {
      const res = await fetch("/api/copilot/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const payload = (await res.json().catch(() => ({}))) as CopilotConversationDetail | { detail?: unknown };
      if (!res.ok) {
        setPageError(getErrorMessage(payload, isEn ? "Could not start a new chat." : "নতুন চ্যাট শুরু করা যায়নি।"));
        return null;
      }

      const conversation = payload as ActiveConversation;
      setActiveConversation(conversation);
      setConversations((prev) => [
        {
          id: conversation.id,
          title: conversation.title,
          locale: conversation.locale,
          last_message_preview: null,
          updated_at: conversation.updated_at,
          last_message_at: conversation.last_message_at,
        },
        ...prev.filter((item) => item.id !== conversation.id),
      ]);
      setMobileSidebarOpen(false);
      return conversation;
    } finally {
      setCreatingConversation(false);
    }
  };

  const deleteCurrentConversation = async (conversationId: number) => {
    const confirmed = window.confirm(
      isEn
        ? "Delete this chat history? This cannot be undone."
        : "এই চ্যাট হিস্টোরি মুছে ফেলবেন? এটা আর ফেরত আনা যাবে না।",
    );
    if (!confirmed) return;

    setDeletingConversationId(conversationId);
    setPageError("");
    try {
      const res = await fetch(`/api/copilot/conversations/${conversationId}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setPageError(getErrorMessage(payload, isEn ? "Could not delete this chat." : "এই চ্যাট মুছে ফেলা যায়নি।"));
        return;
      }
      const remaining = conversations.filter((item) => item.id !== conversationId);
      setConversations(remaining);

      if (activeConversation?.id === conversationId) {
        setActiveConversation(null);
        if (remaining.length > 0) {
          await openConversation(remaining[0].id);
        }
      }
    } finally {
      setDeletingConversationId(null);
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? composer).trim();
    if (!text || sending) return;

    setPageError("");
    setComposer("");
    setSending(true);

    let conversation = activeConversation;
    if (!conversation) {
      conversation = await createConversation();
      if (!conversation) {
        setComposer(text);
        setSending(false);
        return;
      }
    }

    const tempUser = buildTempMessage("user", text, { tempKey: `user-${Date.now()}` });
    const tempAssistant = buildTempMessage(
      "assistant",
      isEn ? "Thinking…" : "ভাবছি…",
      { tempKey: `assistant-${Date.now()}`, pending: true },
    );

    setActiveConversation((current) => {
      if (!current || current.id !== conversation!.id) return current;
      return {
        ...current,
        messages: [...current.messages, tempUser, tempAssistant],
      };
    });

    setConversations((prev) => [
      {
        id: conversation.id,
        title: conversation.title,
        locale: conversation.locale,
        last_message_preview: text,
        updated_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
      },
      ...prev.filter((item) => item.id !== conversation!.id),
    ]);

    try {
      const res = await fetch(`/api/copilot/conversations/${conversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, locale }),
      });
      const payload = (await res.json().catch(() => ({}))) as CopilotMessage | { detail?: unknown };
      if (!res.ok) {
        const errorMessage = getErrorMessage(payload, isEn ? "Could not get an answer." : "উত্তর পাওয়া যায়নি।");
        setPageError(errorMessage);
        setActiveConversation((current) => {
          if (!current || current.id !== conversation!.id) return current;
          return {
            ...current,
            messages: [
              ...current.messages.filter((message) => message.tempKey !== tempAssistant.tempKey),
              buildTempMessage("assistant", errorMessage, { failed: true, tempKey: `error-${Date.now()}` }),
            ],
          };
        });
        return;
      }

      setActiveConversation((current) => {
        if (!current || current.id !== conversation!.id) return current;
        return {
          ...current,
          locale,
          messages: current.messages.map((message) =>
            message.tempKey === tempAssistant.tempKey
              ? { ...(payload as CopilotMessage) }
              : message
          ),
        };
      });
      await loadConversationList({ preferredConversationId: conversation.id });
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (initialQuestion.trim()) {
        await loadConversationList({ autoOpenFirst: false });
        await createConversation();
        return;
      }
      await loadConversationList();
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoPromptRef.current && initialQuestion.trim() && activeConversation && activeConversation.messages.length === 0) {
      autoPromptRef.current = true;
      void sendMessage(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion, activeConversation?.id]);

  useEffect(() => {
    if (!messageEndRef.current) return;
    messageEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeConversation?.messages.length, sending]);

  const voiceLabel = isEn ? "English voice" : "বাংলা ভয়েস";

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
            {isEn ? "Copilot" : "কপাইলট"}
          </p>
          <h2 className="mt-1 text-lg font-bold text-foreground">
            {isEn ? "Chat History" : "চ্যাট হিস্টোরি"}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          className="rounded-full border border-border p-2 text-muted-foreground lg:hidden"
          aria-label={isEn ? "Close history" : "হিস্টোরি বন্ধ করুন"}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-border px-4 py-4">
        <button
          type="button"
          onClick={() => void createConversation()}
          disabled={creatingConversation}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {creatingConversation ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
          {isEn ? "New chat" : "নতুন চ্যাট"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loadingHistory ? (
          <div className="space-y-3 p-1">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="rounded-2xl border border-border p-3">
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-3 w-full animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            {isEn ? "No saved chats yet. Start a conversation to build your history." : "এখনও কোনো সংরক্ষিত চ্যাট নেই। নতুন প্রশ্ন করলেই হিস্টোরি তৈরি হবে।"}
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => {
              const active = activeConversation?.id === conversation.id;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => void openConversation(conversation.id)}
                  className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/8"
                      : "border-border bg-card hover:border-primary/30 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{conversation.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {openingConversationId === conversation.id
                          ? (isEn ? "Opening…" : "খোলা হচ্ছে…")
                          : conversation.last_message_preview ?? (isEn ? "Empty conversation" : "খালি কথোপকথন")}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatConversationTime(conversation.last_message_at, locale)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {isEn
            ? "Copilot answers come from indexed records only. Verify important details from the original source before taking action."
            : "কপাইলট শুধু ইনডেক্স করা তথ্য থেকে উত্তর দেয়। গুরুত্বপূর্ণ সিদ্ধান্ত নেওয়ার আগে মূল উৎস থেকে তথ্য যাচাই করুন।"}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 h-[78vh] overflow-hidden rounded-3xl border border-border bg-card shadow-card">
            {SidebarContent}
          </div>
        </aside>

        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/45 lg:hidden">
            <div className="h-full w-[86%] max-w-sm overflow-hidden bg-background shadow-2xl">
              {SidebarContent}
            </div>
          </div>
        )}

        <section className="flex min-h-[78vh] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(true)}
                  className="rounded-full border border-border p-2 text-muted-foreground lg:hidden"
                  aria-label={isEn ? "Open history" : "হিস্টোরি খুলুন"}
                >
                  <Menu className="h-4 w-4" />
                </button>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">
                    {isEn ? "AI Opportunity Copilot" : "AI Opportunity Copilot"}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {activeConversation?.title ?? (isEn ? "Thread-aware chat over verified opportunities" : "যাচাইকৃত সুযোগের উপর থ্রেড-ভিত্তিক চ্যাট")}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground">
                  <Mic2 className="h-3.5 w-3.5 text-primary" />
                  <span>{voiceLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setVoiceEnabled((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {voiceEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                  <span>{voiceEnabled ? (isEn ? "Voice on" : "ভয়েস চালু") : (isEn ? "Muted" : "মিউট")}</span>
                </button>
                {activeConversation && (
                  <button
                    type="button"
                    onClick={() => void deleteCurrentConversation(activeConversation.id)}
                    disabled={deletingConversationId === activeConversation.id}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-300"
                  >
                    {deletingConversationId === activeConversation.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    <span>{isEn ? "Delete chat" : "চ্যাট মুছুন"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {pageError && (
              <Card className="mb-4 border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-300">
                {pageError}
              </Card>
            )}

            {!activeConversation ? (
              <div className="flex h-full min-h-[52vh] flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h2 className="mt-5 text-2xl font-bold text-foreground">
                  {isEn ? "Ask like a real chat" : "চ্যাটের মতো করেই জিজ্ঞাসা করুন"}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {isEn
                    ? "Start a thread, ask follow-ups, listen to answers, and review related job suggestions when they help."
                    : "নতুন থ্রেড শুরু করুন, ফলো-আপ প্রশ্ন করুন, উত্তর শুনুন, আর দরকার হলে নিচে সম্পর্কিত চাকরির পরামর্শ দেখুন।"}
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {BILINGUAL_PROMPTS.map((prompt) => {
                    const text = isEn ? prompt.en : prompt.bn;
                    return (
                      <button
                        key={prompt.en}
                        type="button"
                        onClick={() => {
                          setComposer(text);
                          void sendMessage(text);
                        }}
                        className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
                      >
                        {text}
                      </button>
                    );
                  })}
                </div>

                <Button className="mt-6" onClick={() => void createConversation()} disabled={creatingConversation}>
                  {creatingConversation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquarePlus className="mr-2 h-4 w-4" />}
                  {isEn ? "Start a new chat" : "নতুন চ্যাট শুরু করুন"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeConversation.messages.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border bg-muted/20 p-6 text-center">
                    <p className="text-lg font-semibold text-foreground">
                      {isEn ? "This conversation is empty" : "এই কথোপকথন এখনও খালি"}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {isEn
                        ? "Ask your first question below or tap a starter prompt."
                        : "নিচের বক্সে প্রথম প্রশ্ন লিখুন, অথবা একটি starter prompt বেছে নিন।"}
                    </p>
                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                      {BILINGUAL_PROMPTS.slice(0, 4).map((prompt) => {
                        const text = isEn ? prompt.en : prompt.bn;
                        return (
                          <button
                            key={prompt.en}
                            type="button"
                            onClick={() => {
                              setComposer(text);
                              void sendMessage(text);
                            }}
                            className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
                          >
                            {text}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  activeConversation.messages.map((message) => {
                    const assistant = message.role === "assistant";
                    return (
                      <div
                        key={message.id}
                        className={`flex ${assistant ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-3xl rounded-3xl px-4 py-3 sm:px-5 ${
                            assistant
                              ? message.failed
                                ? "border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-200"
                                : "border border-border bg-muted/30 text-foreground"
                              : "bg-primary text-white"
                          }`}
                        >
                          <div className="mb-2 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
                              {assistant ? (
                                <>
                                  <Sparkles className="h-3.5 w-3.5" />
                                  <span>{isEn ? "Assistant" : "সহকারী"}</span>
                                </>
                              ) : (
                                <span>{isEn ? "You" : "আপনি"}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] opacity-80">
                              {assistant && !message.pending && voiceEnabled && (
                                <MiniVoiceButton
                                  text={message.content}
                                  locale={locale}
                                  label={isEn ? "Listen" : "শুনুন"}
                                  className="border-current/20 text-inherit hover:text-inherit"
                                />
                              )}
                              <span>{formatMessageTime(message.created_at, locale)}</span>
                            </div>
                          </div>

                          <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                          {assistant && message.pending && (
                            <div className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              {isEn ? "Building an answer from indexed opportunities…" : "ইনডেক্স করা সুযোগ থেকে উত্তর তৈরি হচ্ছে…"}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {(bottomSuggestions.followUps.length > 0 || bottomSuggestions.citations.length > 0) && (
                  <div className="rounded-3xl border border-border bg-background/70 p-4 sm:p-5">
                    <div className="flex items-center gap-2">
                      <PanelLeftClose className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-bold text-foreground">
                        {isEn ? "Helpful next steps" : "পরের দরকারি ধাপ"}
                      </h3>
                    </div>

                    {bottomSuggestions.followUps.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {bottomSuggestions.followUps.map((item) => (
                          <button
                            key={item.text}
                            type="button"
                            onClick={() => void sendMessage(item.text)}
                            className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
                          >
                            {item.text}
                          </button>
                        ))}
                      </div>
                    )}

                    {bottomSuggestions.citations.length > 0 && (
                      <div className="mt-5 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-muted-foreground">
                            {isEn ? "Suggested opportunities" : "প্রাসঙ্গিক সুযোগ"}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {isEn ? "Based on the latest answer" : "সর্বশেষ উত্তরের ভিত্তিতে"}
                          </span>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
                          {bottomSuggestions.citations.slice(0, 3).map((citation) => (
                            <div key={citation.opportunity_id} className="min-w-[260px] sm:min-w-0">
                              <OpportunityCard item={citationToCard(citation)} variant="compact" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div ref={messageEndRef} />
              </div>
            )}
          </div>

          <div className="border-t border-border bg-card/95 px-4 py-4 backdrop-blur sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && composer.trim() && !sending) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder={
                  isEn
                    ? "Ask about jobs, scholarships, visa rules, or your next application step…"
                    : "চাকরি, স্কলারশিপ, ভিসা নীতি, বা আবেদন করার পরের ধাপ সম্পর্কে জিজ্ঞাসা করুন…"
                }
                className="h-12 flex-1 rounded-2xl"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void createConversation()}
                  disabled={creatingConversation}
                  className="inline-flex items-center justify-center rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
                >
                  {creatingConversation ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
                </button>
                <Button
                  onClick={() => void sendMessage()}
                  disabled={!composer.trim() || sending}
                  className="h-12 rounded-2xl px-5"
                >
                  {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SendHorizontal className="mr-2 h-4 w-4" />}
                  {sending ? (isEn ? "Sending…" : "পাঠানো হচ্ছে…") : (isEn ? "Send" : "পাঠান")}
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {isEn
                ? "The assistant answers from verified indexed opportunities and remembers this thread."
                : "সহকারী যাচাইকৃত ইনডেক্স করা সুযোগ থেকে উত্তর দেয় এবং এই থ্রেডের আগের কথাও মনে রাখে।"}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
