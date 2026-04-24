"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { OpportunityCard as OpportunityCardType } from "@/lib/types";
import { formatDate, humanizeSlug } from "@/lib/utils";

export function OpportunityCard({
  item,
  onSavedChange,
}: {
  item: OpportunityCardType;
  onSavedChange?: (saved: boolean) => void;
}) {
  const [saved, setSaved] = useState(item.is_saved);
  const [saving, setSaving] = useState(false);

  const toggleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/saved/${item.id}`, {
        method: saved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        return;
      }
      setSaved((prev) => {
        const next = !prev;
        onSavedChange?.(next);
        return next;
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="fade-up space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/opportunity/${item.id}`} className="font-display text-xl font-bold hover:text-primary">
            {item.title}
          </Link>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {item.employer ?? item.organization ?? "Unknown organization"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{humanizeSlug(item.trust_tier)}</Badge>
          <Badge>{humanizeSlug(item.source_class)}</Badge>
        </div>
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-200">{item.summary ?? "No summary yet."}</p>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <p>Location: {[item.city, item.country].filter(Boolean).join(", ") || "Not specified"}</p>
        <p>Deadline: {item.deadline ? formatDate(item.deadline) : "Open"}</p>
        <p>
          Salary/Funding:{" "}
          {item.salary_min
            ? `${item.salary_min}${item.salary_max ? ` - ${item.salary_max}` : ""} ${item.salary_currency ?? ""}`
            : item.funding_type ?? "Unknown"}
        </p>
        <p>Trust score: {item.trust_score.toFixed(2)}</p>
      </div>
      <p className="rounded-xl bg-slate-100 p-3 text-xs leading-6 dark:bg-slate-800">
        Why this matches: {item.why_this_matches}
      </p>
      <div className="flex justify-between gap-3">
        <Link href={`/opportunity/${item.id}`} className="text-sm font-semibold text-primary">
          View details
        </Link>
        <Button variant="outline" disabled={saving} onClick={toggleSave}>
          {saving ? "Saving..." : saved ? "Saved" : "Save"}
        </Button>
      </div>
    </Card>
  );
}
