"use client";

import {
  AlertTriangle, ChevronLeft, ChevronRight, Edit3, FlaskConical,
  Loader2, Play, Plus, RotateCcw, Save, SearchCode, Trash2, Upload, X, Zap,
} from "lucide-react";
import { useRef, useState } from "react";
import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AdminSource, SourceProbeResult } from "@/lib/types";
import { formatDateTime, humanizeSlug } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────────────────────

const CONNECTOR_OPTIONS = [
  { value: "", label: "Default connector" },
  { value: "search_html_jobs", label: "Search HTML Jobs" },
  { value: "generic_news", label: "Generic HTML" },
  { value: "boesl_brms", label: "BOESL BRMS" },
];

const TRUST_LEVELS = [
  { value: "government_official", label: "সরকারি উৎস", en: "Government official" },
  { value: "verified_source", label: "যাচাইকৃত উৎস", en: "Verified source" },
  { value: "news_source", label: "নিউজ উৎস", en: "News source" },
];

const SOURCES_PER_PAGE = 4;

// ── Types ─────────────────────────────────────────────────────────────────────

interface SourceFormState {
  name: string;
  base_url: string;
  feed_type: string;
  connector_key: string;
  trust_level: string;
  search_queries: string;
  search_results_limit: number;
  child_page_limit: number;
  page_ai_limit: number;
  max_jobs_per_page: number;
  auto_publish: boolean;
  enabled: boolean;
}

interface BulkImportResult {
  created: number;
  skipped: number;
  errors: Array<{ row: number; detail: string }>;
}

interface SourceTestResult {
  source_id: number;
  source_name: string;
  pages_found: number;
  sample_titles: string[];
  queries_used: string[];
  search_results_found: number;
  child_pages_followed: number;
  pages_selected_for_ai: number;
  jobs_extracted_preview: number;
  compliance_warning: string | null;
  error: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getResponseMessage(response: Response, fallback: string): Promise<string> {
  const text = await response.text();
  if (!text) return fallback;
  try {
    const data = JSON.parse(text) as { detail?: unknown; message?: unknown };
    if (typeof data.detail === "string") return data.detail;
    if (typeof data.message === "string") return data.message;
  } catch { return text; }
  return fallback;
}

function isBlockedProbe(result: SourceProbeResult): boolean {
  return Boolean(result.scrape_warning?.toLowerCase().startsWith("blocked:"));
}

function probeTone(result: SourceProbeResult): string {
  if (result.error) {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:border-rose-700/30";
  }
  if (result.is_scrapable) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-700/30 dark:text-emerald-300";
  }
  if (isBlockedProbe(result)) {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:border-rose-700/30";
  }
  return "border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:border-amber-700/30 dark:text-amber-300";
}

const defaultForm: SourceFormState = {
  name: "", base_url: "",
  feed_type: "html",
  connector_key: "",
  trust_level: "news_source",
  search_queries: "",
  search_results_limit: 10,
  child_page_limit: 10,
  page_ai_limit: 25,
  max_jobs_per_page: 10,
  auto_publish: false,
  enabled: true,
};

function isSearchConnectorKey(value: string): boolean {
  return value === "search_html_jobs";
}

function formFromSource(s: AdminSource): SourceFormState {
  return {
    name: s.name,
    base_url: s.base_url,
    feed_type: s.feed_type ?? "html",
    connector_key: s.connector_key ?? "",
    trust_level: s.trust_level ?? "news_source",
    search_queries: (s.search_queries ?? []).join(", "),
    search_results_limit: s.search_results_limit ?? 10,
    child_page_limit: s.child_page_limit ?? 10,
    page_ai_limit: s.page_ai_limit ?? 25,
    max_jobs_per_page: s.max_jobs_per_page ?? 10,
    auto_publish: s.auto_publish ?? false,
    enabled: s.enabled ?? s.is_active ?? true,
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SourcePagination({ currentPage, totalPages, totalItems, pageStart, pageEnd, onPageChange, className = "" }: {
  currentPage: number; totalPages: number; totalItems: number;
  pageStart: number; pageEnd: number; onPageChange: (p: number) => void; className?: string;
}) {
  if (totalItems <= SOURCES_PER_PAGE) return null;
  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
      <Button variant="outline" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} className="h-9 px-3">
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-[140px] text-center text-sm font-medium text-slate-600 dark:text-slate-300">
        {pageStart}–{pageEnd} / {totalItems}
      </span>
      <span className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900">
        {currentPage} / {totalPages}
      </span>
      <Button variant="outline" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="h-9 px-3">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AdminSourceManager({ initialSources }: { initialSources: AdminSource[] }) {
  const locale = useLocale() as "bn" | "en";
  const isEn = locale === "en";

  const [sources, setSources] = useState(initialSources);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SourceFormState>(defaultForm);
  const [probeResult, setProbeResult] = useState<SourceProbeResult | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkImportResult | null>(null);
  const [testResult, setTestResult] = useState<SourceTestResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick Add state
  const [quickUrl, setQuickUrl] = useState("");
  const [quickName, setQuickName] = useState("");
  const [quickProbeResult, setQuickProbeResult] = useState<SourceProbeResult | null>(null);
  const isSearchConnector = isSearchConnectorKey(form.connector_key);

  const refreshSources = async () => {
    const res = await fetch("/api/admin/sources", { cache: "no-store" });
    if (!res.ok) { setStatusMessage(isEn ? "Could not refresh sources." : "উৎস রিফ্রেশ করা যায়নি।"); return; }
    const data = (await res.json()) as AdminSource[];
    setSources(data);
    setCurrentPage((p) => Math.min(p, Math.max(1, Math.ceil(data.length / SOURCES_PER_PAGE))));
  };

  const resetForm = () => { setEditingId(null); setForm(defaultForm); setProbeResult(null); };

  const setField = <K extends keyof SourceFormState>(key: K, value: SourceFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const probeUrl = async () => {
    if (!form.base_url) return;
    setBusyKey("probe"); setProbeResult(null);
    try {
      const res = await fetch("/api/admin/sources/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: form.base_url }),
      });
      const data = (await res.json()) as SourceProbeResult;
      setProbeResult(data);
      if (data.feed_type && !data.error) {
        setField("feed_type", data.feed_type);
        if (data.suggested_name && !form.name) setField("name", data.suggested_name);
      }
    } finally { setBusyKey(null); }
  };

  const submit = async () => {
    setBusyKey("form"); setStatusMessage("");
    try {
      const payload = {
        name: form.name,
        base_url: form.base_url,
        feed_type: form.feed_type || null,
        connector_key: form.connector_key || null,
        trust_level: form.trust_level || null,
        search_queries: form.search_queries.split(",").map((q) => q.trim()).filter(Boolean),
        search_results_limit: form.search_results_limit,
        child_page_limit: form.child_page_limit,
        page_ai_limit: form.page_ai_limit,
        max_jobs_per_page: form.max_jobs_per_page,
        auto_publish: false,
        enabled: form.enabled,
        requires_admin_review: true,
        is_active: form.enabled,
      };
      const res = await fetch(editingId ? `/api/admin/sources/${editingId}` : "/api/admin/sources", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { setStatusMessage(await getResponseMessage(res, isEn ? "Could not save source." : "উৎস সংরক্ষণ করা যায়নি।")); return; }
      await refreshSources();
      resetForm();
      setStatusMessage(editingId ? (isEn ? "Source updated." : "উৎস আপডেট হয়েছে।") : (isEn ? "Source created." : "উৎস তৈরি হয়েছে।"));
    } finally { setBusyKey(null); }
  };

  const startEdit = (s: AdminSource) => { setEditingId(s.id); setForm(formFromSource(s)); setProbeResult(null); setStatusMessage(""); setTestResult(null); };

  const triggerCrawl = async (sourceId: number) => {
    setBusyKey(`crawl-${sourceId}`); setStatusMessage("");
    try {
      const res = await fetch("/api/admin/source-crawls", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId }),
      });
      setStatusMessage(await getResponseMessage(res, isEn ? `Crawl queued for #${sourceId}.` : `ক্রল সারিতে যোগ হয়েছে।`));
      await refreshSources();
    } finally { setBusyKey(null); }
  };

  const testSource = async (sourceId: number) => {
    setBusyKey(`test-${sourceId}`); setTestResult(null); setStatusMessage("");
    try {
      const res = await fetch(`/api/admin/sources/${sourceId}/test`, { method: "POST" });
      const data = (await res.json()) as SourceTestResult;
      setTestResult(data);
    } finally { setBusyKey(null); }
  };

  const deleteSource = async (sourceId: number) => {
    setBusyKey(`delete-${sourceId}`); setStatusMessage("");
    try {
      const res = await fetch(`/api/admin/sources/${sourceId}`, { method: "DELETE" });
      if (!res.ok) { setStatusMessage(isEn ? "Could not delete source." : "মুছতে সমস্যা হয়েছে।"); return; }
      if (editingId === sourceId) resetForm();
      setStatusMessage(isEn ? `Source ${sourceId} deleted.` : `উৎস ${sourceId} মুছে ফেলা হয়েছে।`);
      await refreshSources();
    } finally { setBusyKey(null); }
  };

  const bulkImport = async (file: File) => {
    setBusyKey("bulk"); setStatusMessage(""); setBulkResult(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/admin/sources/bulk-import", { method: "POST", body: fd });
      if (!res.ok) { setStatusMessage(isEn ? "Import failed." : "আমদানি ব্যর্থ হয়েছে।"); return; }
      const result = (await res.json()) as BulkImportResult;
      setBulkResult(result);
      setStatusMessage(isEn ? `${result.created} created, ${result.skipped} skipped.` : `${result.created}টি তৈরি, ${result.skipped}টি এড়ানো।`);
      await refreshSources();
    } finally { setBusyKey(null); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const triggerAllCrawls = async () => {
    if (!confirm(isEn ? "Start crawling all active sources?" : "সব সক্রিয় সোর্সের ক্রল শুরু করবেন?")) return;
    setBusyKey("trigger-all"); setStatusMessage("");
    try {
      const res = await fetch("/api/admin/crawls/trigger-all", { method: "POST" });
      const data = (await res.json()) as { queued: number; skipped: number };
      setStatusMessage(isEn ? `${data.queued} sources queued.` : `${data.queued}টি সোর্সের ক্রল শুরু।`);
      await refreshSources();
    } finally { setBusyKey(null); }
  };

  const reindexAll = async () => {
    if (!confirm(isEn ? "Re-embed all opportunities?" : "সব সুযোগ পুনঃ-ইম্বেড করবেন?")) return;
    setBusyKey("reindex-all"); setStatusMessage("");
    try {
      const res = await fetch("/api/admin/reindex-all", { method: "POST" });
      const data = (await res.json()) as { queued: number };
      setStatusMessage(isEn ? `${data.queued} queued.` : `${data.queued}টি সারিতে।`);
    } finally { setBusyKey(null); }
  };

  const quickProbe = async () => {
    if (!quickUrl) return;
    setBusyKey("quick-probe"); setQuickProbeResult(null);
    try {
      const res = await fetch("/api/admin/sources/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: quickUrl }),
      });
      const data = (await res.json()) as SourceProbeResult;
      setQuickProbeResult(data);
      if (data.suggested_name && !quickName) setQuickName(data.suggested_name);
    } finally { setBusyKey(null); }
  };

  const quickAdd = async () => {
    if (!quickUrl || !quickProbeResult || quickProbeResult.error) return;
    setBusyKey("quick-add"); setStatusMessage("");
    try {
      const name = quickName || quickProbeResult.suggested_name || new URL(quickUrl).hostname;
      const payload = {
        name,
        base_url: quickUrl,
        feed_type: quickProbeResult.feed_type || "html",
        trust_level: "news_source",
        auto_publish: false,
        enabled: true,
        requires_admin_review: true,
        is_active: true,
      };
      const res = await fetch("/api/admin/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setStatusMessage(await getResponseMessage(res, isEn ? "Could not create source." : "উৎস তৈরি করা যায়নি।"));
        return;
      }
      setStatusMessage(isEn ? `Source "${name}" created.` : `উৎস "${name}" তৈরি হয়েছে।`);
      setQuickUrl(""); setQuickName(""); setQuickProbeResult(null);
      await refreshSources();
    } finally { setBusyKey(null); }
  };

  const resetAllData = async () => {
    if (!confirm(isEn
      ? "DELETE ALL sources, opportunities, crawl jobs, and raw documents? This cannot be undone."
      : "সব উৎস, সুযোগ, ক্রল ডেটা মুছে ফেলবেন? এটি পূর্বাবস্থায় ফেরানো যাবে না।"
    )) return;
    setBusyKey("reset-all"); setStatusMessage("");
    try {
      const res = await fetch("/api/admin/reset-all-data", { method: "POST" });
      const data = (await res.json()) as { deleted_sources: number; deleted_opportunities: number };
      setStatusMessage(isEn
        ? `Reset: ${data.deleted_sources} sources and ${data.deleted_opportunities} opportunities deleted.`
        : `রিসেট: ${data.deleted_sources}টি উৎস এবং ${data.deleted_opportunities}টি সুযোগ মুছে ফেলা হয়েছে।`
      );
      await refreshSources();
    } finally { setBusyKey(null); }
  };

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sources.length / SOURCES_PER_PAGE));
  const visiblePage = Math.min(currentPage, totalPages);
  const pageStartIndex = (visiblePage - 1) * SOURCES_PER_PAGE;
  const paginatedSources = sources.slice(pageStartIndex, pageStartIndex + SOURCES_PER_PAGE);
  const pageStart = sources.length === 0 ? 0 : pageStartIndex + 1;
  const pageEnd = Math.min(pageStartIndex + SOURCES_PER_PAGE, sources.length);
  const changePage = (p: number) => setCurrentPage(Math.min(Math.max(p, 1), totalPages));

  const enabledCount = sources.filter((s) => s.enabled ?? s.is_active).length;
  const totalPublished = sources.reduce((n, s) => n + (s.published_count ?? 0), 0);
  const totalPending = sources.reduce((n, s) => n + (s.pending_review_count ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [isEn ? "Sources" : "উৎস", String(sources.length), `${enabledCount} ${isEn ? "enabled" : "সক্রিয়"}`],
          [isEn ? "Published" : "প্রকাশিত", String(totalPublished), isEn ? "Live opportunities" : "লাইভ সুযোগ"],
          [isEn ? "Pending Review" : "পর্যালোচনা বাকি", String(totalPending), isEn ? "Drafts awaiting admin" : "অ্যাডমিন অনুমোদন বাকি"],
          [isEn ? "Raw Docs" : "কাঁচা ডক", String(sources.reduce((n, s) => n + s.raw_document_count, 0)), isEn ? "Stored snapshots" : "সংরক্ষিত স্ন্যাপশট"],
        ].map(([label, value, hint]) => (
          <Card key={label} className="rounded-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
            <p className="mt-1 font-display text-3xl font-bold">{value}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">{hint}</p>
          </Card>
        ))}
      </div>

      {/* Quick Add */}
      <Card className="rounded-lg p-5 border-dashed border-2 border-primary/30 bg-primary/5">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {isEn ? "Quick Add" : "দ্রুত যোগ করুন"}
          </p>
          <h2 className="font-display text-xl font-bold mt-0.5">
            {isEn ? "Add a source by URL" : "URL দিয়ে উৎস যোগ করুন"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isEn
              ? "Paste a URL — the system will probe and detect feed type, name, and sector automatically."
              : "URL দিন — সিস্টেম স্বয়ংক্রিয়ভাবে ফিড ধরন, নাম ও সেক্টর শনাক্ত করবে।"}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48 space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">URL</span>
            <Input
              placeholder="https://example.gov.bd/jobs"
              value={quickUrl}
              onChange={(e) => { setQuickUrl(e.target.value); setQuickProbeResult(null); }}
              onKeyDown={(e) => e.key === "Enter" && quickProbe()}
            />
          </div>
          <div className="flex-1 min-w-40 space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {isEn ? "Name (optional)" : "নাম (ঐচ্ছিক)"}
            </span>
            <Input
              placeholder={isEn ? "Auto-detected" : "স্বয়ংক্রিয়"}
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
            />
          </div>
          <Button
            onClick={quickProbe}
            disabled={busyKey === "quick-probe" || !quickUrl}
            variant="outline"
            className="border-primary text-primary hover:bg-primary/10"
          >
            {busyKey === "quick-probe"
              ? <Loader2 className="mr-2 size-4 animate-spin" />
              : <SearchCode className="mr-2 size-4" />}
            {isEn ? "Analyze" : "বিশ্লেষণ"}
          </Button>
          {quickProbeResult && !quickProbeResult.error && !isBlockedProbe(quickProbeResult) && (
            <Button
              onClick={quickAdd}
              disabled={busyKey === "quick-add"}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {busyKey === "quick-add"
                ? <Loader2 className="mr-2 size-4 animate-spin" />
                : <Plus className="mr-2 size-4" />}
              {isEn ? "Confirm & Add" : "নিশ্চিত ও যোগ করুন"}
            </Button>
          )}
        </div>

        {quickProbeResult && (
          <div className={`mt-3 rounded-md border px-4 py-3 text-sm ${probeTone(quickProbeResult)}`}>
            {quickProbeResult.error ? (
              <p className="font-medium">{quickProbeResult.error}</p>
            ) : (
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-3 text-xs font-semibold">
                  <span className="rounded border border-white/40 bg-white/60 px-2 py-0.5 dark:bg-white/10">
                    {quickProbeResult.feed_type.toUpperCase()}
                  </span>
                  <span>
                    {quickProbeResult.is_scrapable
                      ? (isEn ? "Scrapable" : "স্ক্র্যাপ করা যাবে")
                      : isBlockedProbe(quickProbeResult)
                      ? (isEn ? "Blocked" : "ব্লকড")
                      : (isEn ? "Linkout only" : "শুধু লিংকআউট")}
                  </span>
                  {quickProbeResult.suggested_name && (
                    <span>{isEn ? "Name:" : "নাম:"} {quickProbeResult.suggested_name}</span>
                  )}
                  {quickProbeResult.detected_language && (
                    <span>{isEn ? "Lang:" : "ভাষা:"} {quickProbeResult.detected_language}</span>
                  )}
                  {quickProbeResult.suggested_isc_sector && (
                    <span className="rounded bg-teal-100 px-2 py-0.5 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400">
                      ISC: {quickProbeResult.suggested_isc_sector}
                    </span>
                  )}
                  {quickProbeResult.estimated_opportunities_per_crawl != null && (
                    <span>~{quickProbeResult.estimated_opportunities_per_crawl} {isEn ? "per crawl" : "প্রতি ক্রল"}</span>
                  )}
                </div>
                {quickProbeResult.scrape_warning && (
                  <p className="text-xs font-medium">{quickProbeResult.scrape_warning}</p>
                )}
                {quickProbeResult.sample_titles.length > 0 && (
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                    {quickProbeResult.sample_titles.slice(0, 3).map((t, i) => (
                      <li key={i} className="truncate">• {t}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Form */}
      <Card className="rounded-lg p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {editingId ? (isEn ? "Edit Source" : "উৎস সম্পাদনা") : (isEn ? "Add Source" : "উৎস যোগ")}
            </p>
            <h2 className="font-display text-2xl font-bold">
              {editingId ? (isEn ? `Update source #${editingId}` : `উৎস #${editingId} আপডেট`) : (isEn ? "Register a new source" : "নতুন উৎস নিবন্ধন")}
            </h2>
            <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              {isEn
                ? "Keep setup simple: choose the site, pick the connector, and every new item will still go to the admin review queue before publishing."
                : "সেটআপ সহজ রাখুন: সাইট, connector আর trust level বেছে দিন। নতুন সব আইটেম প্রকাশের আগে admin review queue-তে যাবে।"}
            </p>
          </div>
          {statusMessage && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
              {statusMessage}
            </p>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Name */}
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isEn ? "Name" : "নাম"}</span>
            <Input
              placeholder="BOESL BRMS"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
            />
          </label>

          {/* URL + Auto-detect */}
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isEn ? "URL" : "URL"}</span>
            <div className="flex gap-2">
              <Input
                placeholder="https://boesl.gov.bd/"
                value={form.base_url}
                onChange={(e) => setField("base_url", e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={probeUrl}
                disabled={busyKey === "probe" || !form.base_url}
                className="shrink-0"
              >
                {busyKey === "probe"
                  ? <Loader2 className="size-4 animate-spin" />
                  : <SearchCode className="size-4" />}
                <span className="ml-1.5 hidden sm:inline">{isEn ? "Auto-detect" : "স্বয়ংক্রিয়"}</span>
              </Button>
            </div>
            {/* Probe result inline */}
            {probeResult && (
              <div className={`mt-1.5 rounded-md border px-3 py-2 text-xs ${probeTone(probeResult)}`}>
                {probeResult.error
                  ? probeResult.error
                  : <>
                      <span className="font-semibold">{probeResult.feed_type.toUpperCase()}</span>
                      <> · {probeResult.is_scrapable ? (isEn ? "Scrapable" : "স্ক্র্যাপেবল") : isBlockedProbe(probeResult) ? (isEn ? "Blocked" : "ব্লকড") : (isEn ? "Linkout only" : "শুধু লিংকআউট")}</>
                      {probeResult.suggested_name && <> · {probeResult.suggested_name}</>}
                      {probeResult.detected_language && <> · {probeResult.detected_language}</>}
                      {probeResult.scrape_warning && <div className="mt-1 font-medium">{probeResult.scrape_warning}</div>}
                      {probeResult.sample_titles.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-slate-600 dark:text-slate-400">
                          {probeResult.sample_titles.slice(0, 3).map((t, i) => <li key={i} className="truncate">• {t}</li>)}
                        </ul>
                      )}
                    </>
                }
              </div>
            )}
            <p className="text-xs text-slate-500">
              {isEn
                ? `Detected type: ${(probeResult?.feed_type ?? form.feed_type).toUpperCase()}.`
                : `সনাক্ত উৎস ধরন: ${(probeResult?.feed_type ?? form.feed_type).toUpperCase()}.`}
            </p>
          </div>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isEn ? "Connector" : "Connector"}</span>
            <select
              value={form.connector_key}
              onChange={(e) => setField("connector_key", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CONNECTOR_OPTIONS.map(({ value, label }) => <option key={value || "default"} value={value}>{label}</option>)}
            </select>
            <p className="text-xs text-slate-500">
              {isEn
                ? "Pick a site-specific connector when possible. Use Search HTML Jobs only for broad search-driven discovery."
                : "সম্ভব হলে site-specific connector বেছে নিন। বড় পরিসরের search-driven discovery-এর জন্য শুধু Search HTML Jobs ব্যবহার করুন।"}
            </p>
          </label>

          {/* Trust level */}
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isEn ? "Trust Level" : "বিশ্বাসযোগ্যতা"}</span>
            <select
              value={form.trust_level}
              onChange={(e) => setField("trust_level", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— {isEn ? "select" : "বেছে নিন"} —</option>
              {TRUST_LEVELS.map(({ value, label, en }) => (
                <option key={value} value={value}>{isEn ? en : label}</option>
              ))}
            </select>
          </label>

          {isSearchConnector && (
            <div className="space-y-4 lg:col-span-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  {isEn ? "Search-driven mode" : "Search-driven mode"}
                </p>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                  {isEn
                    ? "Use this mode only when you want search results to discover opportunities across multiple sites."
                    : "একাধিক সাইটে search result ব্যবহার করে সুযোগ খুঁজতে চাইলে শুধু এই mode ব্যবহার করুন।"}
                </p>
              </div>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isEn ? "Search Queries" : "Search Queries"}</span>
                <Input
                  placeholder="welder jobs, recruitment notice, apply now"
                  value={form.search_queries}
                  onChange={(e) => setField("search_queries", e.target.value)}
                />
                <p className="text-xs text-slate-500">
                  {isEn ? "Separate multiple queries with commas." : "একাধিক query comma দিয়ে আলাদা করুন।"}
                </p>
              </label>

              <details className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {isEn ? "Advanced crawl settings" : "Advanced crawl settings"}
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isEn ? "Search Results Limit" : "Search Results Limit"}</span>
                    <Input
                      type="number"
                      min={1}
                      value={form.search_results_limit}
                      onChange={(e) => setField("search_results_limit", Number(e.target.value) || 1)}
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isEn ? "Child Page Limit" : "Child Page Limit"}</span>
                    <Input
                      type="number"
                      min={0}
                      value={form.child_page_limit}
                      onChange={(e) => setField("child_page_limit", Number(e.target.value) || 0)}
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isEn ? "AI Page Limit" : "AI Page Limit"}</span>
                    <Input
                      type="number"
                      min={1}
                      value={form.page_ai_limit}
                      onChange={(e) => setField("page_ai_limit", Number(e.target.value) || 1)}
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isEn ? "Max Jobs Per Page" : "Max Jobs Per Page"}</span>
                    <Input
                      type="number"
                      min={1}
                      value={form.max_jobs_per_page}
                      onChange={(e) => setField("max_jobs_per_page", Number(e.target.value) || 1)}
                    />
                  </label>
                </div>
              </details>
            </div>
          )}

          {/* Toggles */}
          <div className="flex flex-wrap gap-5 lg:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setField("enabled", e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="font-medium">{isEn ? "Enabled" : "সক্রিয়"}</span>
            </label>
            <p className="text-xs text-slate-500">
              {isEn
                ? "Auto-publish is disabled. All new opportunities from this source will go to review first."
                : "Auto-publish বন্ধ। এই উৎসের নতুন সব opportunity আগে review-তে যাবে।"}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
            <Button onClick={submit} disabled={busyKey === "form" || !form.name || !form.base_url}>
              {busyKey === "form"
                ? <Loader2 className="mr-2 size-4 animate-spin" />
                : editingId ? <Save className="mr-2 size-4" /> : <Plus className="mr-2 size-4" />}
              {busyKey === "form"
                ? (isEn ? "Saving…" : "সংরক্ষণ হচ্ছে…")
                : editingId ? (isEn ? "Update source" : "আপডেট করুন") : (isEn ? "Create source" : "উৎস তৈরি")}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm}>
                <X className="mr-2 size-4" />
                {isEn ? "Cancel" : "বাতিল"}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Source test result */}
      {testResult && (
        <Card className={`rounded-lg p-4 ${testResult.error ? "border-rose-300 bg-rose-50 dark:bg-rose-950/20" : "border-green-300 bg-green-50 dark:bg-green-950/20"}`}>
          <p className="font-semibold text-sm">{isEn ? "Source Test:" : "উৎস পরীক্ষা:"} {testResult.source_name}</p>
          {testResult.error
            ? <p className="text-xs text-rose-700 mt-1">{testResult.error}</p>
            : <>
                <p className="text-xs text-green-700 mt-1">{isEn ? `${testResult.pages_found} pages found.` : `${testResult.pages_found}টি পেজ পাওয়া গেছে।`}</p>
                <p className="text-xs text-slate-700 mt-1">
                  {`Queries: ${testResult.queries_used.length} · Search results: ${testResult.search_results_found} · Child pages: ${testResult.child_pages_followed} · AI pages: ${testResult.pages_selected_for_ai} · Jobs previewed: ${testResult.jobs_extracted_preview}`}
                </p>
                {testResult.compliance_warning && <p className="text-xs text-amber-700 mt-1">{testResult.compliance_warning}</p>}
                {testResult.queries_used.length > 0 && (
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{testResult.queries_used.join(" | ")}</p>
                )}
                {testResult.sample_titles.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                    {testResult.sample_titles.map((t, i) => <li key={i} className="truncate">• {t}</li>)}
                  </ul>
                )}
              </>
          }
        </Card>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".csv,.xlsx" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) bulkImport(f); }}
      />

      {/* Source list */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{isEn ? "Registry" : "রেজিস্ট্রি"}</p>
            <h2 className="font-display text-2xl font-bold">{isEn ? "Source Health and Controls" : "উৎসের স্বাস্থ্য ও নিয়ন্ত্রণ"}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={busyKey === "bulk"}>
              <Upload className="mr-2 size-4" />
              {busyKey === "bulk" ? (isEn ? "Importing…" : "আমদানি হচ্ছে…") : (isEn ? "Bulk import" : "বাল্ক আমদানি")}
            </Button>
            <Button variant="outline" onClick={triggerAllCrawls} disabled={busyKey === "trigger-all"} className="border-primary text-primary hover:bg-primary/5">
              <Zap className="mr-2 size-4" />
              {busyKey === "trigger-all" ? (isEn ? "Starting…" : "শুরু হচ্ছে…") : (isEn ? "Crawl all" : "সব ক্রল")}
            </Button>
            <Button variant="outline" onClick={refreshSources}>
              <RotateCcw className="mr-2 size-4" />
              {isEn ? "Refresh" : "রিফ্রেশ"}
            </Button>
            <Button variant="outline" onClick={reindexAll} disabled={busyKey === "reindex-all"}>
              <RotateCcw className={`mr-2 size-4 ${busyKey === "reindex-all" ? "animate-spin" : ""}`} />
              {busyKey === "reindex-all" ? (isEn ? "Queuing…" : "সারিতে…") : (isEn ? "Re-embed all" : "পুনঃ-ইম্বেড")}
            </Button>
            <Button
              variant="ghost"
              onClick={resetAllData}
              disabled={busyKey === "reset-all"}
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10"
            >
              <AlertTriangle className="mr-2 size-4" />
              {busyKey === "reset-all" ? (isEn ? "Resetting…" : "রিসেট হচ্ছে…") : (isEn ? "Reset all data" : "সব ডেটা মুছুন")}
            </Button>
            <SourcePagination currentPage={visiblePage} totalPages={totalPages} totalItems={sources.length} pageStart={pageStart} pageEnd={pageEnd} onPageChange={changePage} />
          </div>
        </div>

        {bulkResult && bulkResult.errors.length > 0 && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/20">
            <p className="font-semibold">{isEn ? "Import issues:" : "আমদানি সমস্যা:"}</p>
            {bulkResult.errors.slice(0, 5).map((err) => (
              <p key={err.row}>{isEn ? "Row" : "সারি"} {err.row}: {err.detail}</p>
            ))}
          </div>
        )}

        {sources.length === 0 ? (
          <Card className="rounded-lg p-8 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-300">{isEn ? "No sources registered yet." : "এখনো কোনো উৎস নিবন্ধন করা হয়নি।"}</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {paginatedSources.map((source) => (
              <article key={source.id} className="rounded-lg border border-slate-200 bg-white/85 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/85">
                <div className="grid gap-4 xl:grid-cols-[minmax(280px,1.6fr)_1fr_auto]">
                  {/* Left */}
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">{source.name}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${(source.enabled ?? source.is_active) ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-slate-200 text-slate-600 dark:bg-slate-800"}`}>
                        {(source.enabled ?? source.is_active) ? (isEn ? "Enabled" : "সক্রিয়") : (isEn ? "Disabled" : "স্থগিত")}
                      </span>
                      {source.last_crawl_status && (
                        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:border-slate-700">
                          {humanizeSlug(source.last_crawl_status, locale)}
                        </span>
                      )}
                      {source.requires_admin_review && (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-900/20 dark:text-violet-400">
                          {isEn ? "Needs review" : "পর্যালোচনা দরকার"}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm text-slate-600 dark:text-slate-300">{source.base_url}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      {source.feed_type && <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">{source.feed_type}</span>}
                      {source.trust_level && <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{source.trust_level}</span>}
                      {source.connector_key && <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{source.connector_key}</span>}
                    </div>
                    {source.last_error && (
                      <p className="text-xs text-rose-600 truncate">{isEn ? "Error:" : "ত্রুটি:"} {source.last_error}</p>
                    )}
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      [isEn ? "Published" : "প্রকাশিত", source.published_count ?? 0],
                      [isEn ? "Pending" : "বাকি", source.pending_review_count ?? 0],
                      [isEn ? "Drafts" : "ড্রাফট", source.draft_count ?? source.opportunity_count],
                      [isEn ? "Fetched" : "এক্সট্র্যাক্ট", source.last_pages_fetched],
                      [isEn ? "Extracted" : "সংরক্ষিত", source.last_records_extracted],
                      [isEn ? "Crawl freq" : "ক্রল ফ্রিক.", source.crawl_frequency ?? "—"],
                    ].map(([label, val]) => (
                      <div key={String(label)} className="rounded bg-slate-50 p-2 dark:bg-slate-950">
                        <p className="font-semibold text-slate-500 uppercase tracking-wide" style={{ fontSize: "10px" }}>{label}</p>
                        <p className="font-bold mt-0.5">{String(val)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => startEdit(source)}>
                      <Edit3 className="mr-1.5 size-3.5" />{isEn ? "Edit" : "সম্পাদনা"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => triggerCrawl(source.id)} disabled={busyKey === `crawl-${source.id}`}>
                      <Play className="mr-1.5 size-3.5" />{busyKey === `crawl-${source.id}` ? (isEn ? "Queuing…" : "সারিতে…") : (isEn ? "Crawl" : "ক্রল")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => testSource(source.id)} disabled={busyKey === `test-${source.id}`}>
                      <FlaskConical className="mr-1.5 size-3.5" />{busyKey === `test-${source.id}` ? (isEn ? "Testing…" : "পরীক্ষা হচ্ছে…") : (isEn ? "Test" : "পরীক্ষা")}
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => deleteSource(source.id)}
                      disabled={busyKey === `delete-${source.id}`}
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10"
                    >
                      <Trash2 className="mr-1.5 size-3.5" />{busyKey === `delete-${source.id}` ? (isEn ? "Deleting…" : "মুছছে…") : (isEn ? "Delete" : "মুছুন")}
                    </Button>
                  </div>
                </div>
                <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
                  {isEn ? "Last crawl:" : "শেষ ক্রল:"} {formatDateTime(source.last_crawl_started_at, locale)}{" "}
                  {isEn ? "· finished:" : "· শেষ:"} {formatDateTime(source.last_crawl_finished_at, locale)}
                </p>
              </article>
            ))}
            <SourcePagination currentPage={visiblePage} totalPages={totalPages} totalItems={sources.length} pageStart={pageStart} pageEnd={pageEnd} onPageChange={changePage} className="pt-2" />
          </div>
        )}
      </div>
    </div>
  );
}
