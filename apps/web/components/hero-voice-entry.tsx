"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, SendHorizontal, Sparkles, X } from "lucide-react";

import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { cn } from "@/lib/utils";
import { getLocalizedCopy, UX_COPY } from "@/lib/ux-copy";

const PROMPTS = UX_COPY.samplePrompts;

interface HeroVoiceEntryProps {
  isEn: boolean;
  onInteractionChange?: (engaged: boolean) => void;
}

export function HeroVoiceEntry({ isEn, onInteractionChange }: HeroVoiceEntryProps) {
  const router = useRouter();
  const locale = isEn ? "en" : "bn";
  const speech = useSpeechRecognition(locale);
  const [text, setText] = useState("");
  const [inputMode, setInputMode] = useState<"voice" | "text">("text");
  const [voiceStartPending, setVoiceStartPending] = useState(false);
  const hasDraft = text.trim().length > 0;
  const isEngaged = voiceStartPending || speech.isListening || hasDraft;

  useEffect(() => {
    if (speech.transcript) {
      setText(speech.transcript);
    }
  }, [speech.transcript]);

  useEffect(() => {
    if (speech.isListening || speech.error) {
      setVoiceStartPending(false);
    }
  }, [speech.error, speech.isListening]);

  useEffect(() => {
    onInteractionChange?.(isEngaged);
  }, [isEngaged, onInteractionChange]);

  useEffect(() => {
    return () => {
      onInteractionChange?.(false);
    };
  }, [onInteractionChange]);

  useEffect(() => {
    if (!speech.isListening && speech.finalTranscript.trim()) {
      setText(speech.finalTranscript);
      setInputMode("voice");
    }
  }, [speech.isListening, speech.finalTranscript]);

  const openCopilot = (question: string, mode: "voice" | "text", autoSpeak: boolean) => {
    const clean = question.trim();
    if (!clean) {
      return;
    }
    const params = new URLSearchParams({
      q: clean,
      mode,
      autoSpeak: autoSpeak ? "1" : "0",
    });
    router.push(`/copilot?${params.toString()}`);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    openCopilot(text, inputMode, inputMode === "voice");
  };

  const toggleListening = () => {
    if (speech.isListening) {
      setVoiceStartPending(false);
      speech.stopListening();
      return;
    }
    speech.resetTranscript();
    setText("");
    setVoiceStartPending(true);
    speech.startListening();
  };

  const errorText = (() => {
    if (!speech.error || speech.error === "no-speech") return "";
    if (speech.error === "not-allowed") {
      return getLocalizedCopy(UX_COPY.voiceStates.permissionDenied, locale);
    }
    if (speech.error === "unsupported") {
      return getLocalizedCopy(UX_COPY.voiceStates.unsupported, locale);
    }
    return getLocalizedCopy(UX_COPY.voiceStates.unsupported, locale);
  })();

  return (
    <div className="w-full rounded-[28px] border border-white/70 bg-white/95 p-3.5 text-slate-950 shadow-xl backdrop-blur-md md:max-w-xl md:rounded-2xl md:border-white/20 md:p-5 md:shadow-2xl">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-teal-700 md:text-sm">
        <Sparkles className="h-4 w-4" />
        <span className="md:hidden">{getLocalizedCopy(UX_COPY.heroVoiceInput.labelMobile, locale)}</span>
        <span className="hidden md:inline">{getLocalizedCopy(UX_COPY.heroVoiceInput.label, locale)}</span>
      </div>

      <form onSubmit={submit} className="mt-3 space-y-3">
        <div className="flex items-center gap-2 md:gap-3">
          {/* Main Input Pill (WhatsApp Style - Highlighted) */}
          <div className="flex flex-1 items-center gap-1.5 rounded-full border-2 border-slate-300 bg-white px-4 py-1.5 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-500/20 shadow-sm transition-all duration-200">
            {/* Input Element */}
            <label className="sr-only" htmlFor="hero-ai-question">
              {getLocalizedCopy(UX_COPY.heroVoiceInput.label, locale)}
            </label>
            <input
              data-testid="hero-ai-input"
              id="hero-ai-question"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setInputMode("text");
              }}
              placeholder={speech.isListening ? getLocalizedCopy(UX_COPY.heroVoiceInput.placeholderListening, locale) : getLocalizedCopy(UX_COPY.heroVoiceInput.placeholderIdle, locale)}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 md:text-base py-1"
            />

            {/* Right Mic Toggle Button inside Input Pill (Shown when empty OR when actively listening) */}
            {(!hasDraft || speech.isListening) && (
              <button
                data-testid="hero-voice-toggle"
                type="button"
                onClick={toggleListening}
                aria-label={speech.isListening ? getLocalizedCopy(UX_COPY.heroVoiceInput.stopListeningAria, locale) : getLocalizedCopy(UX_COPY.heroVoiceInput.startListeningAria, locale)}
                className={cn(
                  "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all focus-visible:outline-none",
                  speech.isListening 
                    ? "bg-rose-500 text-white animate-pulse" 
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                )}
              >
                {speech.isListening ? (
                  <>
                    <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/30" />
                    <Mic className="h-5 w-5" />
                  </>
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>
            )}
          </div>

          {/* Send Button (Outside/next to the pill. Shown when there is text AND not actively listening) */}
          {(hasDraft && !speech.isListening) && (
            <button
              type="submit"
              aria-label={getLocalizedCopy(UX_COPY.heroVoiceInput.sendAria, locale)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white hover:bg-[#008f72] shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              <SendHorizontal className="h-5 w-5 text-white" />
            </button>
          )}
        </div>

        {speech.isListening ? (
          <div className="flex items-center justify-between px-2 text-xs text-rose-500 font-medium">
            <span>{getLocalizedCopy(UX_COPY.heroVoiceInput.helperTextListening, locale)}</span>
            <div className="flex items-center gap-1" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((item) => (
                <span
                  key={item}
                  className="h-3 w-1 animate-pulse rounded-full bg-rose-500"
                  style={{ animationDelay: `${item * 90}ms` }}
                />
              ))}
            </div>
          </div>
        ) : !hasDraft ? (
          <p className="min-h-5 px-2 text-xs text-slate-400">
            {getLocalizedCopy(UX_COPY.heroVoiceInput.helperTextIdle, locale)}
          </p>
        ) : (
          <div className="min-h-5" />
        )}

        {errorText ? (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            <span>{errorText}</span>
            <button type="button" onClick={() => speech.resetTranscript()} aria-label={isEn ? "Clear" : "মুছুন"}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </form>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 md:mt-4 md:flex-wrap md:overflow-visible">
        {PROMPTS.map((prompt) => {
          const label = getLocalizedCopy(prompt, locale);
          return (
            <button
              key={prompt.en}
              type="button"
              onClick={() => openCopilot(label, "text", false)}
              aria-label={isEn ? `Ask: ${label}` : `প্রশ্ন করুন: ${label}`}
              className="shrink-0 whitespace-nowrap rounded-full border border-teal-100 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 transition hover:border-teal-300 hover:bg-teal-100 md:whitespace-normal md:py-1.5"
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
