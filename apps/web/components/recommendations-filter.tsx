"use client";

import { useState } from "react";

import { OpportunityCard } from "@/components/opportunity-card";
import type { RecommendationCard } from "@/lib/types";

type FilterKey = "all" | "strong_match" | "from_bd";

export function RecommendationsFilter({
  items,
  locale,
}: {
  items: RecommendationCard[];
  locale: "bn" | "en";
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const isEn = locale === "en";

  const filtered = items.filter((item) => {
    if (filter === "strong_match") return (item.match_score ?? 0) >= 0.75;
    if (filter === "from_bd") return item.can_apply_from_bd === true;
    return true;
  });

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: isEn ? "All" : "সব" },
    { key: "strong_match", label: isEn ? "Strong match" : "উচ্চ মিল" },
    { key: "from_bd", label: isEn ? "Apply from BD" : "বাংলাদেশ থেকে আবেদন" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              filter === key
                ? "bg-primary text-white"
                : "border border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isEn ? "No opportunities match this filter." : "এই ফিল্টারে কোনো সুযোগ পাওয়া যায়নি।"}
        </p>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => (
            <OpportunityCard key={item.id} item={item} showMatchBanner />
          ))}
        </div>
      )}
    </div>
  );
}
