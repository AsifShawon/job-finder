"use client";

import {
  AlertTriangle, ChevronLeft, ChevronRight, Edit3, FlaskConical,
  Play, Plus, RotateCcw, Save, Trash2, Upload, X, Zap,
} from "lucide-react";
import { useRef, useState } from "react";
import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AdminSource } from "@/lib/types";
import { formatDateTime, humanizeSlug } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────────────────────

const SOURCE_TYPES = ["news", "job_board", "job_pdf", "policy", "scholarship", "training", "rss", "api", "linkout_only", "hybrid"];
const INGESTION_MODES = ["html", "html_with_pdf", "pdf", "rss", "api", "open_data", "manual", "linkout_only", "dynamic_html"];
const CONNECTOR_KEYS = [
  "generic_news", "generic_rss", "generic_pdf", "generic_policy", "generic_scholarship", "generic_training",
  "boesl_brms", "boesl_reports_pdf", "bmet_connector", "oep_connector",
  "eures_connector", "usa_jobs_api", "reliefweb_api", "jobbank_linkout", "linkout_only",
];
const COMPLIANCE_STATUSES = ["allowed", "use_api_only", "rss_only", "linkout_only", "manual_review_required", "unknown"];
const CRAWL_FREQUENCIES = ["hourly", "daily", "weekly", "manual"];
const TRUST_LEVELS = ["government_official", "official_partner", "verified_source", "news_source", "unknown"];
const FIRST_CRAWL_MODES = ["active_only", "backfill_recent", "backfill_all", "preview_only", "linkout_only"];
const TARGET_AUDIENCE_OPTIONS = [
  "bangladeshi_applicants", "international_candidates", "temporary_foreign_workers",
  "authorized_workers_only", "students", "skilled_workers", "low_skilled_workers", "scholarship_seekers",
];
const SOURCES_PER_PAGE = 4;

// ── Types ─────────────────────────────────────────────────────────────────────

interface SourceFormState {
  name: string;
  base_url: string;
  root_url: string;
  country: string;
  country_scope: string;
  source_type: string;
  ingestion_mode: string;
  connector_key: string;
  trust_level: string;
  compliance_status: string;
  crawl_frequency: string;
  first_crawl_mode: string;
  target_audience: string[];
  search_keywords: string[];
  enabled: boolean;
  requires_admin_review: boolean;
  // legacy
  source_class: string;
  trust_tier: string;
  access_method: string;
  crawl_frequency_minutes: number;
  parser_key: string;
  search_queries: string[];
  is_active: boolean;
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

const defaultForm: SourceFormState = {
  name: "", base_url: "", root_url: "", country: "Bangladesh",
  country_scope: "", source_type: "", ingestion_mode: "", connector_key: "",
  trust_level: "", compliance_status: "unknown", crawl_frequency: "daily",
  first_crawl_mode: "active_only", target_audience: [], search_keywords: [],
  enabled: true, requires_admin_review: true,
  // legacy
  source_class: "news_policy", trust_tier: "news_only",
  access_method: "static_html", crawl_frequency_minutes: 1440,
  parser_key: "default", search_queries: [], is_active: true,
};

function formFromSource(s: AdminSource): SourceFormState {
  return {
    name: s.name, base_url: s.base_url, root_url: s.root_url ?? "",
    country: s.country ?? "Bangladesh", country_scope: s.country_scope ?? "",
    source_type: s.source_type ?? "", ingestion_mode: s.ingestion_mode ?? "",
    connector_key: s.connector_key ?? "", trust_level: s.trust_level ?? "",
    compliance_status: s.compliance_status ?? "unknown",
    crawl_frequency: s.crawl_frequency ?? "daily",
    first_crawl_mode: s.first_crawl_mode ?? "active_only",
    target_audience: s.target_audience ?? [],
    search_keywords: s.search_keywords ?? [],
    enabled: s.enabled ?? s.is_active ?? true,
    requires_admin_review: s.requires_admin_review ?? true,
    // legacy
    source_class: s.source_class ?? "news_policy",
    trust_tier: s.trust_tier ?? "news_only",
    access_method: s.access_method ?? "static_html",
    crawl_frequency_minutes: s.crawl_frequency_minutes ?? 1440,
    parser_key: s.parser_key ?? "default",
    search_queries: s.search_queries ?? [],
    is_active: s.is_active ?? true,
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SelectField({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <option value="">— select —</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

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
  const [keywordDraft, setKeywordDraft] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkImportResult | null>(null);
  const [testResult, setTestResult] = useState<SourceTestResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshSources = async () => {
    const res = await fetch("/api/admin/sources", { cache: "no-store" });
    if (!res.ok) { setStatusMessage(isEn ? "Could not refresh sources." : "উৎস রিফ্রেশ করা যায়নি।"); return; }
    const data = (await res.json()) as AdminSource[];
    setSources(data);
    setCurrentPage((p) => Math.min(p, Math.max(1, Math.ceil(data.length / SOURCES_PER_PAGE))));
  };

  const resetForm = () => { setEditingId(null); setForm(defaultForm); setKeywordDraft(""); };

  const setField = <K extends keyof SourceFormState>(key: K, value: SourceFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const addKeyword = () => {
    const kw = keywordDraft.trim();
    if (!kw) return;
    setField("search_keywords", [...form.search_keywords, kw]);
    setKeywordDraft("");
  };

  const toggleAudience = (tag: string) => {
    setField("target_audience",
      form.target_audience.includes(tag)
        ? form.target_audience.filter((t) => t !== tag)
        : [...form.target_audience, tag]
    );
  };

  const submit = async () => {
    setBusyKey("form"); setStatusMessage("");
    try {
      const payload = {
        ...form,
        source_type: form.source_type || null,
        ingestion_mode: form.ingestion_mode || null,
        connector_key: form.connector_key || null,
        trust_level: form.trust_level || null,
        country_scope: form.country_scope || null,
        root_url: form.root_url || null,
        first_crawl_mode: form.first_crawl_mode || null,
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

  const startEdit = (s: AdminSource) => { setEditingId(s.id); setForm(formFromSource(s)); setKeywordDraft(""); setStatusMessage(""); setTestResult(null); };

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

      {/* Form */}
      <Card className="rounded-lg p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {editingId ? (isEn ? "Edit Source" : "উৎস সম্পাদনা") : (isEn ? "Create Source" : "উৎস তৈরি")}
            </p>
            <h2 className="font-display text-2xl font-bold">
              {editingId ? (isEn ? `Update source #${editingId}` : `উৎস #${editingId} আপডেট`) : (isEn ? "Register a new source" : "নতুন উৎস নিবন্ধন")}
            </h2>
          </div>
          {statusMessage && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
              {statusMessage}
            </p>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-12">
          {/* Basic */}
          <label className="space-y-1 lg:col-span-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isEn ? "Name" : "নাম"}</span>
            <Input placeholder="BOESL BRMS" value={form.name} onChange={(e) => setField("name", e.target.value)} />
          </label>
          <label className="space-y-1 lg:col-span-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isEn ? "Base URL" : "মূল URL"}</span>
            <Input placeholder="https://boesl.gov.bd/" value={form.base_url} onChange={(e) => setField("base_url", e.target.value)} />
          </label>
          <label className="space-y-1 lg:col-span-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isEn ? "Root URL (crawler start)" : "রুট URL (ক্রলার শুরু)"}</span>
            <Input placeholder="https://boesl.gov.bd/jobs" value={form.root_url} onChange={(e) => setField("root_url", e.target.value)} />
          </label>

          <label className="space-y-1 lg:col-span-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isEn ? "Country" : "দেশ"}</span>
            <Input placeholder="Bangladesh" value={form.country} onChange={(e) => setField("country", e.target.value)} />
          </label>
          <label className="space-y-1 lg:col-span-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isEn ? "Country Scope" : "কভার দেশ"}</span>
            <Input placeholder="BD,CA,MY" value={form.country_scope} onChange={(e) => setField("country_scope", e.target.value)} />
          </label>

          {/* Connector + type */}
          <div className="lg:col-span-3">
            <SelectField label={isEn ? "Source Type" : "উৎস ধরন"} value={form.source_type} options={SOURCE_TYPES} onChange={(v) => setField("source_type", v)} />
          </div>
          <div className="lg:col-span-3">
            <SelectField label={isEn ? "Ingestion Mode" : "ইনজেশন মোড"} value={form.ingestion_mode} options={INGESTION_MODES} onChange={(v) => setField("ingestion_mode", v)} />
          </div>
          <div className="lg:col-span-4">
            <SelectField label={isEn ? "Connector Key" : "কানেক্টর"} value={form.connector_key} options={CONNECTOR_KEYS} onChange={(v) => setField("connector_key", v)} />
          </div>
          <div className="lg:col-span-3">
            <SelectField label={isEn ? "Compliance" : "কমপ্লায়েন্স"} value={form.compliance_status} options={COMPLIANCE_STATUSES} onChange={(v) => setField("compliance_status", v)} />
          </div>
          <div className="lg:col-span-3">
            <SelectField label={isEn ? "Trust Level" : "বিশ্বাসযোগ্যতা"} value={form.trust_level} options={TRUST_LEVELS} onChange={(v) => setField("trust_level", v)} />
          </div>
          <div className="lg:col-span-3">
            <SelectField label={isEn ? "Crawl Frequency" : "ক্রল ফ্রিকোয়েন্সি"} value={form.crawl_frequency} options={CRAWL_FREQUENCIES} onChange={(v) => setField("crawl_frequency", v)} />
          </div>
          <div className="lg:col-span-3">
            <SelectField label={isEn ? "First Crawl Mode" : "প্রথম ক্রল মোড"} value={form.first_crawl_mode} options={FIRST_CRAWL_MODES} onChange={(v) => setField("first_crawl_mode", v)} />
          </div>

          {/* Target audience checkboxes */}
          <div className="space-y-2 lg:col-span-12">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{isEn ? "Target Audience" : "লক্ষ্য দর্শক"}</span>
            <div className="flex flex-wrap gap-2">
              {TARGET_AUDIENCE_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleAudience(tag)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    form.target_audience.includes(tag)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-200 text-slate-500 hover:border-primary hover:text-primary dark:border-slate-700"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Flags */}
          <div className="flex flex-wrap gap-4 lg:col-span-12">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setField("enabled", e.target.checked)} className="h-4 w-4 rounded" />
              {isEn ? "Enabled (crawlable)" : "সক্রিয় (ক্রলযোগ্য)"}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.requires_admin_review} onChange={(e) => setField("requires_admin_review", e.target.checked)} className="h-4 w-4 rounded" />
              {isEn ? "Requires admin review" : "অ্যাডমিন পর্যালোচনা দরকার"}
            </label>
          </div>

          {/* Search keywords */}
          <div className="space-y-2 lg:col-span-12">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{isEn ? "Search Keywords (for API connectors)" : "সার্চ কীওয়ার্ড (API কানেক্টরের জন্য)"}</span>
            {form.search_keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.search_keywords.map((kw, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {kw}
                    <button type="button" onClick={() => setField("search_keywords", form.search_keywords.filter((_, j) => j !== i))}>
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder={isEn ? "e.g. Bangladesh engineer" : "যেমন: Bangladesh engineer"}
                value={keywordDraft}
                onChange={(e) => setKeywordDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                className="max-w-sm"
              />
              <Button type="button" variant="outline" onClick={addKeyword} disabled={!keywordDraft.trim()}>
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 lg:col-span-12">
            <Button onClick={submit} disabled={busyKey === "form" || !form.name || !form.base_url}>
              {busyKey === "form" ? <RotateCcw className="mr-2 size-4 animate-spin" /> : editingId ? <Save className="mr-2 size-4" /> : <Plus className="mr-2 size-4" />}
              {busyKey === "form" ? (isEn ? "Saving…" : "সংরক্ষণ হচ্ছে…") : editingId ? (isEn ? "Update source" : "আপডেট করুন") : (isEn ? "Create source" : "উৎস তৈরি")}
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
                {testResult.compliance_warning && <p className="text-xs text-amber-700 mt-1">{testResult.compliance_warning}</p>}
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
                      {source.compliance_status && source.compliance_status !== "allowed" && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                          {source.compliance_status}
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
                      {source.connector_key && <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{source.connector_key}</span>}
                      {source.source_type && <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{source.source_type}</span>}
                      {source.ingestion_mode && <span className="rounded bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{source.ingestion_mode}</span>}
                      {source.trust_level && <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">{source.trust_level}</span>}
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
