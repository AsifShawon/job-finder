"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pause, Play, Square, Volume2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type VoiceSection = { label: string; text: string };

type PlayerState = "idle" | "loading" | "playing" | "paused";

async function fetchAudio(text: string, lang: string): Promise<HTMLAudioElement> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, lang }),
  });
  if (!res.ok) throw new Error("TTS fetch failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return new Audio(url);
}

export function OpportunityVoicePlayer({
  sections,
  locale,
}: {
  sections: VoiceSection[];
  locale: "bn" | "en";
}) {
  const t = useTranslations("voice");
  const [state, setState] = useState<PlayerState>("idle");
  const [sectionIndex, setSectionIndex] = useState(0);
  const lang = locale === "bn" ? "bn" : "en";

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<number, HTMLAudioElement>>(new Map());
  const sessionRef = useRef(0);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  const playFrom = useCallback(
    async (i: number, session: number) => {
      if (i >= sections.length) {
        setState("idle");
        setSectionIndex(0);
        return;
      }

      setState("loading");
      setSectionIndex(i);

      let audio = cacheRef.current.get(i);
      if (!audio) {
        try {
          audio = await fetchAudio(sections[i].text, lang);
          cacheRef.current.set(i, audio);
        } catch {
          if (session === sessionRef.current) setState("idle");
          return;
        }
      }

      if (session !== sessionRef.current) return;

      audioRef.current = audio;
      audio.currentTime = 0;
      setState("playing");

      audio.onended = () => {
        if (session === sessionRef.current) playFrom(i + 1, session);
      };

      await audio.play();
    },
    [sections, lang]
  );

  function play() {
    const session = ++sessionRef.current;
    playFrom(sectionIndex, session);
  }

  function pause() {
    audioRef.current?.pause();
    setState("paused");
  }

  function resume() {
    setState("playing");
    audioRef.current?.play();
  }

  function stop() {
    sessionRef.current++;
    cleanup();
    setState("idle");
    setSectionIndex(0);
  }

  const currentSection = sections[sectionIndex];

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold text-foreground">
          {locale === "bn" ? "শুনুন" : "Listen"}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {(state === "idle" || state === "loading") && (
          <button
            onClick={state === "idle" ? play : undefined}
            disabled={state === "loading"}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {state === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {t("listen")}
          </button>
        )}

        {state === "playing" && (
          <>
            <button
              onClick={pause}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              <Pause className="h-4 w-4" />
              {t("pause")}
            </button>
            <button
              onClick={stop}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Square className="h-4 w-4" />
              {t("stop")}
            </button>
          </>
        )}

        {state === "paused" && (
          <>
            <button
              onClick={resume}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              <Play className="h-4 w-4" />
              {t("resume")}
            </button>
            <button
              onClick={stop}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Square className="h-4 w-4" />
              {t("stop")}
            </button>
          </>
        )}
      </div>

      {state !== "idle" && currentSection && (
        <div className="mt-3 space-y-2">
          <p className={cn("text-xs", state === "paused" ? "text-muted-foreground" : "text-foreground")}>
            <span className="font-medium">{t("nowReading")}:</span>{" "}
            {currentSection.label}
          </p>
          <div className="flex gap-1">
            {sections.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  i < sectionIndex
                    ? "bg-primary"
                    : i === sectionIndex
                    ? "bg-primary opacity-60"
                    : "bg-border"
                )}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
