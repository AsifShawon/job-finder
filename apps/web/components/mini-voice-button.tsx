"use client";

import { useRef, useState } from "react";
import { Loader2, Volume2, VolumeX } from "lucide-react";

interface MiniVoiceButtonProps {
  text: string;
  locale: "bn" | "en";
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function MiniVoiceButton({ text, locale, label, className = "", disabled = false }: MiniVoiceButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "playing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const handleClick = async () => {
    if (disabled) {
      return;
    }
    if (status === "playing" && audioRef.current) {
      audioRef.current.pause();
      setStatus("idle");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 2000), lang: locale }),
      });
      if (!res.ok) {
        setStatus("idle");
        return;
      }
      const blob = await res.blob();

      // Clean up previous object URL.
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setStatus("idle");
      audio.onerror = () => setStatus("idle");

      await audio.play();
      setStatus("playing");
    } catch {
      setStatus("idle");
    }
  };

  const defaultLabel = locale === "bn" ? "শুনুন" : "Listen";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50 ${className}`}
      aria-label={label ?? defaultLabel}
    >
      {status === "loading" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : status === "playing" ? (
        <VolumeX className="h-3.5 w-3.5" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
      {label !== undefined && <span>{label}</span>}
    </button>
  );
}
