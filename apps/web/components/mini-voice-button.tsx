"use client";

import { useRef, useState } from "react";
import { Loader2, Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";

interface MiniVoiceButtonProps {
  text: string;
  locale: "bn" | "en";
  label?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "touch";
}

const SIZE_STYLES = {
  sm: "gap-1.5 rounded-full px-2.5 py-1 text-xs",
  touch: "touch-target h-11 w-11 gap-0 rounded-2xl px-0 py-0 text-sm",
} as const;

export function MiniVoiceButton({
  text,
  locale,
  label,
  ariaLabel,
  className,
  disabled = false,
  size = "sm",
}: MiniVoiceButtonProps) {
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
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }

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
  const iconSize = size === "touch" ? "h-[18px] w-[18px]" : "h-3.5 w-3.5";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center border border-border font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50",
        SIZE_STYLES[size],
        className,
      )}
      aria-label={ariaLabel ?? label ?? defaultLabel}
    >
      {status === "loading" ? (
        <Loader2 className={cn(iconSize, "animate-spin")} />
      ) : status === "playing" ? (
        <VolumeX className={iconSize} />
      ) : (
        <Volume2 className={iconSize} />
      )}
      {label ? <span>{label}</span> : null}
    </button>
  );
}
