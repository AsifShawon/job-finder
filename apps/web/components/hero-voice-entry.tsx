"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic2, SendHorizontal, Sparkles, X } from "lucide-react";

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
      openCopilot(speech.finalTranscript, "voice", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    openCopilot(text, "text", false);
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
        <div className="flex items-center gap-2 md:items-start md:gap-3">
          <button
            data-testid="hero-voice-toggle"
            type="button"
            onClick={toggleListening}
            aria-label={speech.isListening ? getLocalizedCopy(UX_COPY.heroVoiceInput.stopListeningAria, locale) : getLocalizedCopy(UX_COPY.heroVoiceInput.startListeningAria, locale)}
            className={cn(
              "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 md:h-16 md:w-16 md:shadow-lg",
              speech.isListening ? "bg-rose-600" : "bg-teal-600 hover:bg-teal-700",
            )}
          >
            {speech.isListening ? (
              <>
                <span className="absolute h-8 w-8 animate-ping rounded-full bg-white/30 md:h-10 md:w-10" />
                <span className="h-3.5 w-3.5 rounded-full bg-white md:h-4 md:w-4" />
              </>
            ) : (
              <Mic2 className="h-5 w-5 md:h-7 md:w-7" />
            )}
          </button>

          <div className="flex h-12 min-w-0 flex-1 flex-col justify-center rounded-2xl border border-slate-200 bg-slate-50 px-3 md:h-auto md:px-4 md:py-3">
            <label className="sr-only" htmlFor="hero-ai-question">
              {getLocalizedCopy(UX_COPY.heroVoiceInput.label, locale)}
            </label>
            <input
              data-testid="hero-ai-input"
              id="hero-ai-question"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={speech.isListening ? getLocalizedCopy(UX_COPY.heroVoiceInput.placeholderListening, locale) : getLocalizedCopy(UX_COPY.heroVoiceInput.placeholderIdle, locale)}
              className="w-full bg-transparent text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-500 md:text-base"
            />
            <p className="mt-1 hidden min-h-5 text-xs text-slate-500 md:block">
              {speech.isListening
                ? getLocalizedCopy(UX_COPY.heroVoiceInput.helperTextListening, locale)
                : getLocalizedCopy(UX_COPY.heroVoiceInput.helperTextIdle, locale)}
            </p>
          </div>

          <button
            type="submit"
            disabled={!text.trim()}
            aria-label={getLocalizedCopy(UX_COPY.heroVoiceInput.sendAria, locale)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 md:h-16 md:w-14"
          >
            <SendHorizontal className="h-5 w-5 md:h-6 md:w-6" />
          </button>
        </div>

        {speech.isListening ? (
          <div className="flex items-center gap-1.5 px-1" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((item) => (
              <span
                key={item}
                className="h-4 w-1.5 animate-pulse rounded-full bg-teal-500 md:h-5"
                style={{ animationDelay: `${item * 90}ms` }}
              />
            ))}
          </div>
        ) : null}

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
