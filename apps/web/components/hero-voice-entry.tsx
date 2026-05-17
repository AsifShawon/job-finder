"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic2, SendHorizontal, Sparkles, X } from "lucide-react";

import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { cn } from "@/lib/utils";

const PROMPTS = [
  { bn: "SSC পাসে কোন দেশে কাজ পাবো?", en: "Which countries hire SSC-pass workers?" },
  { bn: "মালয়েশিয়া যেতে কত খরচ লাগবে?", en: "How much does it cost to go to Malaysia?" },
  { bn: "জার্মানি Ausbildung কীভাবে করবো?", en: "How do I apply for German Ausbildung?" },
  { bn: "কানাডায় নার্স হিসেবে কাজ করতে কী লাগবে?", en: "What do I need to work as a nurse in Canada?" },
];

export function HeroVoiceEntry({ isEn }: { isEn: boolean }) {
  const router = useRouter();
  const locale = isEn ? "en" : "bn";
  const speech = useSpeechRecognition(locale);
  const [text, setText] = useState("");

  useEffect(() => {
    if (speech.transcript) {
      setText(speech.transcript);
    }
  }, [speech.transcript]);

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
      speech.stopListening();
      return;
    }
    speech.resetTranscript();
    setText("");
    speech.startListening();
  };

  const errorText = speech.error && speech.error !== "no-speech"
    ? isEn
      ? "Voice is not available. Type your question instead."
      : "ভয়েস চালু হয়নি। প্রশ্নটি লিখে পাঠাতে পারেন।"
    : "";

  return (
    <div className="w-full max-w-xl rounded-2xl border border-white/20 bg-white/95 p-4 text-slate-950 shadow-2xl backdrop-blur md:p-5">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-teal-700">
        <Sparkles className="h-4 w-4" />
        <span>{isEn ? "Sudokkho AI voice assistant" : "সুদক্ষ AI ভয়েস সহকারী"}</span>
      </div>

      <form onSubmit={submit} className="mt-3 space-y-3">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={toggleListening}
            aria-label={speech.isListening ? (isEn ? "Stop listening" : "শোনা বন্ধ করুন") : (isEn ? "Start voice input" : "ভয়েস ইনপুট শুরু করুন")}
            className={cn(
              "relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300",
              speech.isListening ? "bg-rose-600" : "bg-teal-600 hover:bg-teal-700",
            )}
          >
            {speech.isListening ? (
              <>
                <span className="absolute h-10 w-10 animate-ping rounded-full bg-white/30" />
                <span className="h-4 w-4 rounded-full bg-white" />
              </>
            ) : (
              <Mic2 className="h-7 w-7" />
            )}
          </button>

          <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <label className="sr-only" htmlFor="hero-ai-question">
              {isEn ? "Ask Sudokkho AI" : "সুদক্ষ AI কে বলুন"}
            </label>
            <input
              id="hero-ai-question"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={speech.isListening ? (isEn ? "Listening..." : "শুনছি...") : (isEn ? "Ask about jobs abroad" : "বিদেশের চাকরি নিয়ে বলুন")}
              className="w-full bg-transparent text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-500 md:text-base"
            />
            <p className="mt-1 min-h-5 text-xs text-slate-500">
              {speech.isListening
                ? isEn
                  ? "Speak naturally. We will open Sudokkho AI when you finish."
                  : "স্বাভাবিকভাবে বলুন। শেষ হলে সুদক্ষ AI খুলবে।"
                : isEn
                  ? "Use voice or type your question."
                  : "ভয়েসে বলুন অথবা লিখে প্রশ্ন করুন।"}
            </p>
          </div>

          <button
            type="submit"
            disabled={!text.trim()}
            aria-label={isEn ? "Send to Sudokkho AI" : "সুদক্ষ AI তে পাঠান"}
            className="flex h-16 w-14 shrink-0 items-center justify-center rounded-2xl bg-navy text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <SendHorizontal className="h-6 w-6" />
          </button>
        </div>

        {speech.isListening ? (
          <div className="flex items-center gap-1.5 px-1" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((item) => (
              <span
                key={item}
                className="h-5 w-1.5 animate-pulse rounded-full bg-teal-500"
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

      <div className="mt-4 flex flex-wrap gap-2">
        {PROMPTS.map((prompt) => {
          const label = isEn ? prompt.en : prompt.bn;
          return (
            <button
              key={prompt.en}
              type="button"
              onClick={() => openCopilot(label, "text", false)}
              className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 transition hover:border-teal-300 hover:bg-teal-100"
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
