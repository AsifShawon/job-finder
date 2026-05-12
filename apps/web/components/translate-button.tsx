"use client";

import { useState } from "react";
import { Languages, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Per-field translate button. Reads the source field's current value,
 * calls /api/admin/translate-field, and writes the result into the target.
 *
 * Usage:
 *   <TranslateButton
 *     sourceText={form.title}
 *     sourceLang="en"
 *     targetLang="bn"
 *     fieldName="title"
 *     onTranslated={(text) => setField("title_bn", text)}
 *   />
 */
export function TranslateButton({
  sourceText,
  sourceLang,
  targetLang,
  fieldName,
  onTranslated,
  size = "sm",
  isEn = false,
}: {
  sourceText: string;
  sourceLang: "bn" | "en";
  targetLang: "bn" | "en";
  fieldName?: string;
  onTranslated: (translation: string) => void;
  size?: "sm" | "xs";
  isEn?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const disabled = busy || !sourceText.trim();
  const dirArrow = sourceLang === "en" ? "EN→বাং" : "বাং→EN";

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/translate-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sourceText,
          source_lang: sourceLang,
          target_lang: targetLang,
          field_name: fieldName,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { translation?: string; detail?: string };
      if (!response.ok) {
        setError(payload.detail || (isEn ? "Translation failed" : "অনুবাদ ব্যর্থ"));
        return;
      }
      if (payload.translation) {
        onTranslated(payload.translation);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={run}
        disabled={disabled}
        title={isEn ? `Translate ${sourceLang.toUpperCase()} → ${targetLang.toUpperCase()}` : `অনুবাদ করুন (${dirArrow})`}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-border bg-card font-medium text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50 disabled:hover:border-border disabled:hover:text-foreground",
          size === "sm" ? "px-2 py-1 text-xs" : "px-1.5 py-0.5 text-[10px]",
        )}
      >
        {busy ? (
          <Loader2 className={cn("animate-spin", size === "sm" ? "h-3.5 w-3.5" : "h-3 w-3")} />
        ) : (
          <Languages className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-3 w-3")} />
        )}
        <span>{dirArrow}</span>
      </button>
      {error && <span className="text-[10px] text-rose-600 dark:text-rose-400">{error}</span>}
    </div>
  );
}
