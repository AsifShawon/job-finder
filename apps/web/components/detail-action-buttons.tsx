"use client";

import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, ExternalLink, Loader2, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetailActionButtonsProps {
  opportunityId: string;
  initialSaved: boolean;
  applyHref: string | null;
  locale: "bn" | "en";
  variant?: "hero" | "sticky" | "sidebar";
}

export function DetailActionButtons({
  opportunityId,
  initialSaved,
  applyHref,
  locale,
  variant = "hero",
}: DetailActionButtonsProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [saving, setSaving] = useState(false);
  const isBn = locale === "bn";

  useEffect(() => {
    const handleSavedChange = (e: CustomEvent<{ id: string; saved: boolean }>) => {
      if (e.detail.id === opportunityId) {
        setSaved(e.detail.saved);
      }
    };
    window.addEventListener("saved-status-changed", handleSavedChange as EventListener);
    return () => window.removeEventListener("saved-status-changed", handleSavedChange as EventListener);
  }, [opportunityId]);

  const toggleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/saved/${opportunityId}`, {
        method: saved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const nextSaved = !saved;
        setSaved(nextSaved);
        window.dispatchEvent(
          new CustomEvent("saved-status-changed", {
            detail: { id: opportunityId, saved: nextSaved },
          })
        );
      }
    } catch (err) {
      console.error("Failed to toggle save:", err);
    } finally {
      setSaving(false);
    }
  };

  const triggerListen = () => {
    window.dispatchEvent(new CustomEvent("trigger-voice-play"));
  };

  const applyText = applyHref
    ? isBn
      ? "আবেদন করুন"
      : "Apply"
    : isBn
    ? "আবেদনের লিংক নেই"
    : "Apply link unavailable";

  const listenText = isBn ? "শুনুন" : "Listen";
  const saveText = saved
    ? isBn
      ? "সংরক্ষিত"
      : "Saved"
    : isBn
    ? "সংরক্ষণ"
    : "Save";

  if (variant === "sticky") {
    return (
      <div className="flex w-full items-center justify-between gap-3">
        <button
          onClick={triggerListen}
          className="flex flex-1 flex-col items-center justify-center py-1 text-muted-foreground transition-colors hover:text-primary"
          aria-label={listenText}
        >
          <Volume2 className="h-5 w-5 text-primary" />
          <span className="text-xs font-semibold mt-1">{listenText}</span>
        </button>

        <div className="h-8 w-[1px] bg-border" />

        {applyHref ? (
          <a
            href={applyHref}
            target="_blank"
            rel="noreferrer"
            className="flex-[2] touch-target inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
            aria-label={applyText}
          >
            <span>{applyText}</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : (
          <button
            disabled
            className="flex-[2] touch-target inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-400 cursor-not-allowed"
          >
            <span>{applyText}</span>
          </button>
        )}

        <div className="h-8 w-[1px] bg-border" />

        <button
          onClick={toggleSave}
          disabled={saving}
          className={cn(
            "flex flex-1 flex-col items-center justify-center py-1 transition-colors hover:text-primary",
            saved ? "text-primary" : "text-muted-foreground"
          )}
          aria-label={saveText}
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : saved ? (
            <BookmarkCheck className="h-5 w-5" />
          ) : (
            <Bookmark className="h-5 w-5" />
          )}
          <span className="text-xs font-semibold mt-1">{saveText}</span>
        </button>
      </div>
    );
  }

  // Hero or Sidebar version
  return (
    <div className={cn("flex flex-wrap items-center gap-3", variant === "sidebar" && "flex-col w-full")}>
      {applyHref ? (
        <a
          href={applyHref}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "touch-target inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-base font-bold text-white shadow-sm transition-opacity hover:opacity-90",
            variant === "sidebar" ? "w-full" : "min-w-[150px]"
          )}
          aria-label={isBn ? "Apply now" : "Apply now"}
        >
          <span>{applyText}</span>
          <ExternalLink className="h-4 w-4" />
        </a>
      ) : (
        <button
          disabled
          className={cn(
            "touch-target inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-6 py-3.5 text-base font-bold text-slate-400 cursor-not-allowed",
            variant === "sidebar" ? "w-full" : "min-w-[150px]"
          )}
        >
          <span>{applyText}</span>
        </button>
      )}

      <button
        onClick={triggerListen}
        className={cn(
          "touch-target inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-6 py-3.5 text-base font-bold text-primary transition-colors hover:bg-primary/10",
          variant === "sidebar" ? "w-full" : "min-w-[120px]"
        )}
      >
        <Volume2 className="h-5 w-5" />
        <span>{listenText}</span>
      </button>

      <button
        onClick={toggleSave}
        disabled={saving}
        className={cn(
          "touch-target inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-6 py-3.5 text-base font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary",
          variant === "sidebar" ? "w-full" : "min-w-[120px]"
        )}
      >
        {saving ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : saved ? (
          <>
            <BookmarkCheck className="h-5 w-5 text-primary" />
            <span className="text-primary font-bold">{saveText}</span>
          </>
        ) : (
          <>
            <Bookmark className="h-5 w-5" />
            <span>{saveText}</span>
          </>
        )}
      </button>
    </div>
  );
}
