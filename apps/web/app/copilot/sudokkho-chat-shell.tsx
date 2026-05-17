"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import {
  AlertTriangle,
  History,
  Loader2,
  Menu,
  MessageSquarePlus,
  Mic2,
  PanelLeftClose,
  Pause,
  Play,
  SendHorizontal,
  Sparkles,
  StopCircle,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Home as HomeIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

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
import { cn } from "@/lib/utils";

// --- Constants ---

const BILINGUAL_PROMPTS = [
  { bn: "কানাডায় নার্স হিসেবে কাজ করতে কী লাগবে?", en: "What's needed to work as a nurse in Canada?" },
  { bn: "SSC পাসে কোন দেশে কাজ পাবো?", en: "Which countries hire SSC-pass workers?" },
  { bn: "জার্মানি Ausbildung-এ আবেদন কীভাবে করবো?", en: "How do I apply for German Ausbildung?" },
  { bn: "মালয়েশিয়া যেতে কত খরচ লাগে?", en: "How much does it cost to go to Malaysia?" },
  { bn: "সরকারি বৃত্তির জন্য কীভাবে আবেদন করবো?", en: "How do I apply for government scholarships?" },
  { bn: "দুবাইয়ে ড্রাইভিং চাকরির জন্য কী করতে হবে?", en: "What to do for a driving job in Dubai?" },
];

// --- Types ---

type TimelineMessage = CopilotMessage & {
  tempKey?: string;
  pending?: boolean;
  failed?: boolean;
};

type ActiveConversation = Omit<CopilotConversationDetail, "messages"> & {
  messages: TimelineMessage[];
};

// --- Helper Functions ---

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (Array.isArray(payload)) {
    const parts = payload.map((entry) => getErrorMessage(entry, "")).filter(Boolean);
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
    isc_category_key: null,
    platform_category_bn: null,
    platform_category_en: null,
    salary_min: c.salary_min,
    salary_max: c.salary_max,
    salary_currency: c.salary_currency,
    salary_text: c.salary_text,
    salary_text_bn: c.salary_text_bn,
    salary_text_en: null,
    experience_min_years: c.experience_min_years ?? null,
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
    bangladesh_applicability: null,
    rural_user_fit_score: 0,
    actionability_score: 0,
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

// --- Components ---

/**
 * Main Chat Shell that manages the layout and state
 */
export function SudokkhoChatShell({
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false);

  // Use browsers Speech Recognition
  const [isListening, setIsListening] = useState(false);
  const [recognitionError, setRecognitionError] = useState("");
  const recognitionRef = useRef<any>(null);

  // Use browsers Speech Synthesis
  const [speakingMessageId, setSpeakingMessageId] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

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
      const payload = (await res.json().catch(() => [])) as CopilotConversationListItem[] | { detail?: unknown };
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
      setSidebarOpen(false);
      stopSpeaking();
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
      setSidebarOpen(false);
      stopSpeaking();
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
    stopSpeaking();

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
    const tempAssistant = buildTempMessage("assistant", isEn ? "Thinking…" : "ভাবছি…", {
      tempKey: `assistant-${Date.now()}`,
      pending: true,
    });

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

      const finalAssistantMsg = payload as CopilotMessage;

      setActiveConversation((current) => {
        if (!current || current.id !== conversation!.id) return current;
        return {
          ...current,
          locale,
          messages: current.messages.map((message) =>
            message.tempKey === tempAssistant.tempKey ? { ...finalAssistantMsg } : message,
          ),
        };
      });

      // Auto-speak if enabled
      if (voiceOutputEnabled) {
        speakMessage(finalAssistantMsg.content, finalAssistantMsg.id);
      }

      await loadConversationList({ preferredConversationId: conversation.id });
    } finally {
      setSending(false);
    }
  };

  // --- Voice Input Logic ---

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = locale === "bn" ? "bn-BD" : "en-US";

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join("");
        setComposer(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setRecognitionError(event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [locale]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setRecognitionError("");
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error("Failed to start recognition", err);
        setRecognitionError("not-supported");
      }
    }
  };

  // --- Voice Output Logic ---

  const speakMessage = (text: string, messageId: number) => {
    if (!window.speechSynthesis) return;

    // Stop current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale === "bn" ? "bn-BD" : "en-US";

    // Try to find a better voice if possible
    const voices = window.speechSynthesis.getVoices();
    if (locale === "bn") {
      const bnVoice = voices.find((v) => v.lang.includes("bn-BD") || v.lang.includes("bn-IN"));
      if (bnVoice) utterance.voice = bnVoice;
    } else {
      const enVoice = voices.find((v) => v.lang.includes("en-US") || v.lang.includes("en-GB"));
      if (enVoice) utterance.voice = enVoice;
    }

    utterance.onstart = () => {
      setSpeakingMessageId(messageId);
      setIsPaused(false);
    };
    utterance.onend = () => {
      setSpeakingMessageId(null);
      setIsPaused(false);
    };
    utterance.onerror = () => {
      setSpeakingMessageId(null);
      setIsPaused(false);
    };

    synthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setSpeakingMessageId(null);
    setIsPaused(false);
  };

  const pauseSpeaking = () => {
    window.speechSynthesis.pause();
    setIsPaused(true);
  };

  const resumeSpeaking = () => {
    window.speechSynthesis.resume();
    setIsPaused(false);
  };

  // --- Lifecycle ---

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
    if (
      !autoPromptRef.current &&
      initialQuestion.trim() &&
      activeConversation &&
      activeConversation.messages.length === 0
    ) {
      autoPromptRef.current = true;
      void sendMessage(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion, activeConversation?.id]);

  useEffect(() => {
    if (!messageEndRef.current) return;
    messageEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeConversation?.messages.length, sending]);

  return (
    <div className="fixed inset-0 z-[100] flex h-[100dvh] w-screen flex-col bg-slate-50 dark:bg-slate-950 md:flex-row overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-900 md:flex md:flex-col",
        sidebarOpen ? "w-80" : "w-0 overflow-hidden border-none"
      )}>
        <ChatHistorySidebar
          conversations={conversations}
          activeConversationId={activeConversation?.id}
          onOpen={openConversation}
          onCreate={createConversation}
          loading={loadingHistory}
          creating={creatingConversation}
          isEn={isEn}
          locale={locale}
        />
      </aside>

      {/* Mobile Sidebar / Drawer */}
      <MobileChatHistoryDrawer
        isOpen={sidebarOpen && !window.matchMedia('(min-width: 768px)').matches}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        activeConversationId={activeConversation?.id}
        onOpen={openConversation}
        onCreate={createConversation}
        loading={loadingHistory}
        creating={creatingConversation}
        isEn={isEn}
        locale={locale}
      />

      {/* Main Chat Area */}
      <main className="relative flex flex-1 flex-col overflow-hidden h-full">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              <PanelLeftClose className={cn("h-5 w-5 text-slate-600 transition-transform dark:text-slate-400", !sidebarOpen && "rotate-180")} />
            </button>
            
            <Link 
              href="/" 
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <HomeIcon className="h-4 w-4 text-slate-500" />
              <div className="flex flex-col leading-none">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">সুদক্ষ AI</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">সহকারী</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setVoiceOutputEnabled(!voiceOutputEnabled)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all shadow-sm",
                voiceOutputEnabled
                  ? "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300"
                  : "border-slate-200 bg-white text-slate-600 hover:border-teal-500 hover:text-teal-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
              )}
            >
              {voiceOutputEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{voiceOutputEnabled ? (isEn ? "Voice on" : "ভয়েস চালু") : (isEn ? "Voice off" : "ভয়েস বন্ধ")}</span>
            </button>

            {activeConversation && (
              <button
                onClick={() => deleteCurrentConversation(activeConversation.id)}
                disabled={deletingConversationId === activeConversation.id}
                className="rounded-full p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                aria-label="Delete chat"
              >
                {deletingConversationId === activeConversation.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </header>

        {/* Message Area - Independent Scroll */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth px-4 py-6 md:px-6 lg:px-20 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="mx-auto max-w-3xl space-y-8">
            {!activeConversation ? (
              <EmptyState isEn={isEn} onSelectPrompt={(text: string) => void sendMessage(text)} />
            ) : activeConversation.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center pt-12 md:pt-20">
                <div className="max-w-md w-full rounded-3xl border border-dashed border-slate-200 bg-white/50 p-8 text-center backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-900/30">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {isEn ? "Ready to help" : "আমি প্রস্তুত"}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {isEn ? "How can I assist you with your career goals today?" : "আপনার ক্যারিয়ার সংক্রান্ত কীভাবে সাহায্য করতে পারি?"}
                  </p>
                </div>
                
                <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 w-full max-w-2xl">
                  {BILINGUAL_PROMPTS.slice(0, 4).map((p) => (
                    <button
                      key={p.en}
                      onClick={() => void sendMessage(isEn ? p.en : p.bn)}
                      className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-teal-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 active:scale-[0.98]"
                    >
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400">
                        {isEn ? p.en : p.bn}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-teal-500" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6 pb-4">
                {activeConversation.messages.map((message) => (
                  <ChatMessageBubble
                    key={message.id}
                    message={message}
                    isEn={isEn}
                    locale={locale}
                    isSpeaking={speakingMessageId === message.id}
                    isPaused={isPaused}
                    onSpeak={() => speakMessage(message.content, message.id)}
                    onStop={stopSpeaking}
                    onPause={pauseSpeaking}
                    onResume={resumeSpeaking}
                  />
                ))}

                {(bottomSuggestions.followUps.length > 0 || bottomSuggestions.citations.length > 0) && (
                  <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {bottomSuggestions.followUps.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {bottomSuggestions.followUps.map((item) => (
                          <SuggestedPromptChips
                            key={item.text}
                            text={item.text}
                            onClick={() => void sendMessage(item.text)}
                          />
                        ))}
                      </div>
                    )}

                    {bottomSuggestions.citations.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-slate-400">
                          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">
                            {isEn ? "Citations" : "তথ্যসূত্র"}
                          </span>
                          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {bottomSuggestions.citations.map((citation) => (
                            <OpportunityCard
                              key={citation.opportunity_id}
                              item={citationToCard(citation)}
                              variant="compact"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <div ref={messageEndRef} className="h-4" />
          </div>
        </div>

        {/* Input Area - Fixed Bottom */}
        <div className="shrink-0 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:px-6 md:pb-8">
          <div className="mx-auto max-w-3xl">
            {pageError && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-900/30 dark:bg-rose-900/10 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" />
                {pageError}
              </div>
            )}
            <ChatComposer
              value={composer}
              onChange={setComposer}
              onSend={() => void sendMessage()}
              isSending={sending}
              isListening={isListening}
              onToggleVoice={toggleListening}
              isEn={isEn}
              recognitionError={recognitionError}
            />
            <p className="mt-3 text-center text-[10px] text-slate-400">
              {isEn 
                ? "Sudokkho AI can make mistakes. Check important info." 
                : "সুদক্ষ AI ভুল করতে পারে। গুরুত্বপূর্ণ তথ্য যাচাই করে নিন।"}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

// --- Sub-components ---

function ChatHistorySidebar({
  conversations,
  activeConversationId,
  onOpen,
  onCreate,
  loading,
  creating,
  isEn,
  locale,
}: any) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="p-4 shrink-0">
        <button
          onClick={() => onCreate()}
          disabled={creating}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:bg-teal-700 hover:shadow-lg disabled:opacity-60 active:scale-[0.98]"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
          {isEn ? "New chat" : "নতুন চ্যাট"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-8">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
          {isEn ? "Recent Conversations" : "পুরোনো কথোপকথন"}
        </div>
        {loading ? (
          <div className="space-y-2 px-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-4 py-12 text-center text-xs text-slate-400 italic">
            {isEn ? "No chat history yet" : "এখনো কোনো চ্যাট নেই"}
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((conv: any) => (
              <button
                key={conv.id}
                onClick={() => onOpen(conv.id)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-all",
                  activeConversationId === conv.id
                    ? "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{conv.title}</div>
                  <div className="truncate text-[10px] opacity-60">
                    {formatConversationTime(conv.last_message_at, locale)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function MobileChatHistoryDrawer({ isOpen, onClose, ...props }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] md:hidden">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 w-[280px] bg-white dark:bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
          <h2 className="text-sm font-bold">{props.isEn ? "History" : "হিস্টোরি"}</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ChatHistorySidebar {...props} onOpen={(id: number) => { props.onOpen(id); onClose(); }} onCreate={() => { props.onCreate(); onClose(); }} />
      </div>
    </div>
  );
}

function ChatMessageBubble({
  message,
  isEn,
  locale,
  isSpeaking,
  isPaused,
  onSpeak,
  onStop,
  onPause,
  onResume,
}: any) {
  const assistant = message.role === "assistant";
  return (
    <div className={cn("flex w-full flex-col animate-in fade-in slide-in-from-bottom-2 duration-300", assistant ? "items-start" : "items-end")}>
      <div
        className={cn(
          "relative max-w-[90%] rounded-[2rem] px-5 py-4 shadow-sm transition-all md:max-w-[80%]",
          assistant
            ? message.failed
              ? "border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/30 dark:bg-rose-900/20 dark:text-rose-200"
              : "rounded-tl-none border border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            : "rounded-tr-none bg-teal-600 text-white shadow-md shadow-teal-500/20 dark:shadow-none",
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider opacity-60">
            {assistant ? (
              <>
                <Sparkles className="h-3 w-3 text-teal-500" />
                <span>{isEn ? "Sudokkho AI" : "সুদক্ষ AI"}</span>
              </>
            ) : (
              <span>{isEn ? "You" : "আপনি"}</span>
            )}
          </div>
          <span className="text-[10px] opacity-40 font-mono">{formatMessageTime(message.created_at, locale)}</span>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed md:text-base font-medium">
          {message.content}
        </div>

        {assistant && message.pending && (
          <div className="mt-4 flex items-center gap-2 text-xs text-teal-600 dark:text-teal-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="animate-pulse">{isEn ? "Searching opportunities..." : "তথ্য খোঁজা হচ্ছে..."}</span>
          </div>
        )}

        {assistant && !message.pending && !message.failed && (
          <div className="mt-4 flex items-center justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
            <div className="flex items-center gap-1">
              {isSpeaking ? (
                <div className="flex items-center gap-1 animate-in zoom-in duration-200">
                  <button
                    onClick={isPaused ? onResume : onPause}
                    className="flex h-8 items-center gap-1.5 rounded-full bg-teal-50 px-3 text-[10px] font-bold text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 transition-transform active:scale-95"
                  >
                    {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                    {isPaused ? (isEn ? "Resume" : "চালান") : (isEn ? "Pause" : "থামান")}
                  </button>
                  <button
                    onClick={onStop}
                    className="flex h-8 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400 transition-transform active:scale-95"
                  >
                    <StopCircle className="h-3 w-3" />
                    {isEn ? "Stop" : "বন্ধ করুন"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={onSpeak}
                  className="flex h-8 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-[10px] font-bold text-slate-600 transition-all hover:border-teal-500 hover:text-teal-600 active:scale-95 dark:border-slate-800 dark:text-slate-400"
                >
                  <Volume2 className="h-3 w-3" />
                  {isEn ? "Listen" : "উত্তর শুনুন"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatComposer({
  value,
  onChange,
  onSend,
  isSending,
  isListening,
  onToggleVoice,
  isEn,
  recognitionError,
}: any) {
  return (
    <div className="group relative">
      <div className="relative flex items-end gap-2 rounded-[2rem] border border-slate-200 bg-white p-2.5 shadow-xl ring-teal-500/10 transition-all focus-within:border-teal-500 focus-within:ring-8 dark:border-slate-800 dark:bg-slate-900/90 backdrop-blur-md">
        <button
          onClick={onToggleVoice}
          disabled={isSending}
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-90",
            isListening
              ? "animate-pulse bg-rose-500 text-white shadow-lg shadow-rose-200 dark:shadow-none"
              : "bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-600 dark:bg-slate-800 dark:text-slate-400",
          )}
          title={isListening ? (isEn ? "Stop listening" : "শোনা বন্ধ করুন") : (isEn ? "Voice input" : "ভয়েস ইনপুট")}
        >
          {isListening ? <div className="h-4 w-4 rounded-full bg-white animate-ping" /> : <Mic2 className="h-6 w-6" />}
        </button>

        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={
            isListening
              ? isEn
                ? "Listening..."
                : "শুনছি..."
              : isEn
                ? "Ask anything about jobs abroad..."
                : "বিদেশের চাকরি নিয়ে যা খুশি জিজ্ঞাসা করুন..."
          }
          className="flex-1 resize-none bg-transparent px-3 py-3.5 text-sm font-medium focus:outline-none md:text-base"
          rows={1}
          style={{ minHeight: "48px", maxHeight: "160px" }}
        />

        <button
          onClick={onSend}
          disabled={!value.trim() || isSending}
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-90 shadow-sm",
            value.trim() && !isSending 
              ? "bg-teal-600 text-white hover:bg-teal-700 shadow-teal-500/20" 
              : "bg-slate-100 text-slate-400 dark:bg-slate-800"
          )}
        >
          {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-6 w-6" />}
        </button>
      </div>

      {isListening && (
        <div className="absolute -top-12 left-0 right-0 flex justify-center">
          <div className="flex items-center gap-3 rounded-full bg-teal-600 px-6 py-2 text-xs font-bold text-white shadow-xl">
            <span className="flex h-2 w-2 animate-ping rounded-full bg-white" />
            {isEn ? "Listening... Speak now" : "শুনছি... এখন বলুন"}
          </div>
        </div>
      )}

      {recognitionError && (
        <div className="mt-2 text-center text-[10px] text-rose-500">
          {recognitionError === "not-supported"
            ? (isEn ? "Voice input not supported in this browser." : "এই ব্রাউজারে ভয়েস ইনপুট সাপোর্ট করে না।")
            : (isEn ? "Voice error. Please type your question." : "ভয়েস সমস্যা। লিখে প্রশ্ন করুন।")}
        </div>
      )}
    </div>
  );
}

function EmptyState({ isEn, onSelectPrompt }: any) {
  return (
    <div className="flex flex-col items-center justify-center py-8 md:py-16 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-gradient-to-br from-teal-50 to-teal-100 shadow-inner dark:from-teal-900/20 dark:to-teal-800/10">
        <Sparkles className="h-10 w-10 text-teal-600" />
      </div>
      <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white md:text-5xl leading-tight">
        {isEn ? "How can Sudokkho AI help?" : "সুদক্ষ AI কীভাবে সাহায্য করতে পারে?"}
      </h2>
      <p className="mt-4 max-w-lg text-sm font-medium text-slate-500 dark:text-slate-400 md:text-base">
        {isEn
          ? "Ask anything about overseas careers, visa processes, or verified job opportunities."
          : "বিদেশের চাকরি, ভিসা পদ্ধতি বা ভেরিফাইড সুযোগ নিয়ে যা খুশি জিজ্ঞাসা করুন।"}
      </p>

      <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 w-full max-w-2xl px-4">
        {BILINGUAL_PROMPTS.slice(0, 4).map((p) => (
          <button
            key={p.en}
            onClick={() => onSelectPrompt(isEn ? p.en : p.bn)}
            className="flex flex-col rounded-3xl border border-slate-200 bg-white/80 p-5 text-left transition-all hover:border-teal-500 hover:shadow-lg hover:translate-y-[-2px] dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-sm"
          >
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{isEn ? p.en : p.bn}</span>
            <span className="mt-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-teal-600/70">
              {isEn ? "Try this" : "চেষ্টা করুন"}
              <ChevronRight className="h-3 w-3" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SuggestedPromptChips({ text, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition-all hover:border-teal-500 hover:bg-teal-50 hover:text-teal-700 hover:shadow-md active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
    >
      {text}
    </button>
  );
}
