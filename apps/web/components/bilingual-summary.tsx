"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface BilingualSummaryProps {
  summaryBn: string | null;
  summaryEn: string | null;
  initialLocale?: "bn" | "en";
}

export function BilingualSummary({ summaryBn, summaryEn, initialLocale = "bn" }: BilingualSummaryProps) {
  const [activeTab, setActiveTab] = useState<"bn" | "en">(initialLocale);

  if (!summaryBn && !summaryEn) return null;

  const hasBoth = Boolean(summaryBn && summaryEn);

  return (
    <div>
      {hasBoth && (
        <div className="mb-3 flex gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setActiveTab("bn")}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
              activeTab === "bn"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            বাংলা
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("en")}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
              activeTab === "en"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            English
          </button>
        </div>
      )}
      <p className="text-sm text-foreground leading-relaxed">
        {activeTab === "bn" ? (summaryBn || summaryEn) : (summaryEn || summaryBn)}
      </p>
    </div>
  );
}
