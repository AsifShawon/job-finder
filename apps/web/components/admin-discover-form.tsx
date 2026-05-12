"use client";

import Link from "next/link";
import { useState } from "react";
import { Compass, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface DiscoveryDraft {
  draft_id: number;
  title: string;
  url: string;
  confidence: number;
  is_new: boolean;
}

interface DiscoveryResponse {
  query: string;
  variants: string[];
  urls_considered: number;
  drafts_created: number;
  drafts_updated: number;
  duplicates: number;
  failed: number;
  drafts: DiscoveryDraft[];
  warnings: string[];
}

export function AdminDiscoverForm({ isEn }: { isEn: boolean }) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [maxResults, setMaxResults] = useState(12);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<DiscoveryResponse | null>(null);

  const submit = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const response = await fetch("/api/admin/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          target_country: country.trim() || undefined,
          max_results: maxResults,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as DiscoveryResponse & { detail?: string };
      if (!response.ok) {
        setError(payload.detail || (isEn ? "Discovery failed." : "আবিষ্কার ব্যর্থ।"));
        return;
      }
      setReport(payload);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_140px]">
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">
              {isEn ? "Search query" : "অনুসন্ধান প্রশ্ন"}
            </span>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isEn
                ? "e.g. construction jobs Saudi Arabia for Bangladeshi welders"
                : "যেমন: সৌদি আরবে বাংলাদেশি ওয়েল্ডার পদে নির্মাণ চাকরি"}
              disabled={busy}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">
              {isEn ? "Target country (optional)" : "লক্ষ্য দেশ (ঐচ্ছিক)"}
            </span>
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder={isEn ? "Canada" : "কানাডা"}
              disabled={busy}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">
              {isEn ? "Max results" : "সর্বোচ্চ ফল"}
            </span>
            <Input
              type="number"
              min={1}
              max={30}
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value) || 12)}
              disabled={busy}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={submit} disabled={busy || !query.trim()} className="min-w-[200px]">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Compass className="mr-2 h-4 w-4" />}
            {busy
              ? (isEn ? "Discovering..." : "আবিষ্কার চলছে...")
              : (isEn ? "Run discovery" : "আবিষ্কার শুরু করুন")}
          </Button>
          <Link href="/admin/review" className="text-sm font-semibold text-primary hover:underline">
            {isEn ? "Open review queue" : "রিভিউ কিউ খুলুন"}
          </Link>
        </div>

        {error && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
            {error}
          </p>
        )}
      </Card>

      {report && (
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-bold text-foreground">
              {isEn ? "Discovery report" : "আবিষ্কার রিপোর্ট"}
            </h2>
          </div>

          <div className="mb-4 grid gap-3 text-sm md:grid-cols-5">
            <Stat label={isEn ? "URLs considered" : "URL দেখা হয়েছে"} value={report.urls_considered} />
            <Stat label={isEn ? "New drafts" : "নতুন draft"} value={report.drafts_created} accent="emerald" />
            <Stat label={isEn ? "Updated" : "আপডেট"} value={report.drafts_updated} accent="blue" />
            <Stat label={isEn ? "Duplicates" : "ডুপ্লিকেট"} value={report.duplicates} accent="amber" />
            <Stat label={isEn ? "Failed" : "ব্যর্থ"} value={report.failed} accent="rose" />
          </div>

          {report.variants.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {isEn ? "Search variants tried" : "যে অনুসন্ধান গুলো করা হয়েছে"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {report.variants.map((v, i) => (
                  <span key={i} className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {report.warnings.length > 0 && (
            <ul className="mb-4 space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700/30 dark:bg-amber-900/10 dark:text-amber-300">
              {report.warnings.map((w, i) => (
                <li key={i}>⚠ {w}</li>
              ))}
            </ul>
          )}

          {report.drafts.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {isEn ? "Drafts created/updated" : "তৈরি/আপডেট হওয়া draft"}
              </p>
              <ul className="space-y-2">
                {report.drafts.map((d) => (
                  <li key={d.draft_id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {d.title}{" "}
                        <span className={d.is_new
                          ? "text-xs font-semibold text-emerald-600"
                          : "text-xs font-semibold text-blue-600"}>
                          {d.is_new ? (isEn ? "NEW" : "নতুন") : (isEn ? "UPDATED" : "আপডেট")}
                        </span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{d.url}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {Math.round(d.confidence * 100)}%
                      </span>
                      <Link
                        href={`/admin/review?focus=${d.draft_id}`}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        #{d.draft_id} →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "emerald" | "blue" | "amber" | "rose" }) {
  const colour =
    accent === "emerald" ? "text-emerald-600 dark:text-emerald-400"
    : accent === "blue" ? "text-blue-600 dark:text-blue-400"
    : accent === "amber" ? "text-amber-600 dark:text-amber-400"
    : accent === "rose" ? "text-rose-600 dark:text-rose-400"
    : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-muted/40 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${colour}`}>{value}</p>
    </div>
  );
}
