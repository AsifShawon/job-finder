"use client";

import { useState } from "react";
import {
  AlertTriangle, CheckCircle, ExternalLink, FileText, Loader2, Save,
  ShieldCheck, Trash2, XCircle, Eye, EyeOff, Languages, PenLine, Pencil, Sparkles, X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TranslateButton } from "@/components/translate-button";
import type { DraftItem, ReviewStatus } from "@/lib/types";

const STATUS_LABELS: Record<string, { bn: string; en: string; cls: string }> = {
  pending:          { bn: "অপেক্ষামাণ",      en: "Pending",      cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" },
  approved:         { bn: "অনুমোদিত",         en: "Approved",     cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" },
  rejected:         { bn: "প্রত্যাখ্যাত",      en: "Rejected",     cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400" },
  needs_manual_fix: { bn: "সংশোধন দরকার",    en: "Fix needed",   cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400" },
};

const ELIGIBILITY_LABELS: Record<string, { bn: string; cls: string }> = {
  eligible:               { bn: "আবেদনযোগ্য",         cls: "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-700/30 dark:text-green-400" },
  conditional:            { bn: "শর্তসাপেক্ষ",          cls: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" },
  authorized_workers_only:{ bn: "ওয়ার্ক পারমিট আবশ্যক",  cls: "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400" },
  unclear_manual_review:  { bn: "অস্পষ্ট — যাচাই দরকার", cls: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" },
  not_relevant:           { bn: "প্রযোজ্য নয়",           cls: "bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
};

const OFFICIAL_CONNECTORS = new Set(["successfactors_alfanar", "successfactors_aramco", "tamimi_careers", "maharah_posts"]);

// Map a per-field confidence in [0, 1] to a tailwind text-color class.
// Used to colour-code displayed fields so the reviewer sees at a glance which
// pieces of the extraction the AI was confident about.
function confidenceClass(score: number | undefined): string {
  if (score == null) return "";
  if (score >= 0.8) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 0.5) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (Array.isArray(payload)) {
    const parts = payload
      .map((entry) => getErrorMessage(entry, ""))
      .filter((entry) => entry.trim().length > 0);
    return parts.length > 0 ? parts.join(" ") : fallback;
  }
  if (typeof payload === "object") {
    const detail = (payload as { detail?: unknown }).detail;
    if (detail !== undefined) return getErrorMessage(detail, fallback);
    const msg = (payload as { msg?: unknown }).msg;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return fallback;
}

function EligibilityPills({ item, isEn }: { item: DraftItem; isEn: boolean }) {
  const elig = item.eligibility_status ? ELIGIBILITY_LABELS[item.eligibility_status] : null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {elig && (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${elig.cls}`}>
          {isEn ? item.eligibility_status?.replace(/_/g, " ") : elig.bn}
        </span>
      )}
      {item.can_apply_from_bd === true && (
        <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-400">
          {isEn ? "BD applicants" : "বাংলাদেশ থেকে আবেদনযোগ্য"}
        </span>
      )}
      {item.open_to_international_candidates === true && (
        <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
          {isEn ? "International" : "আন্তর্জাতিক"}
        </span>
      )}
      {item.lmia_status && item.lmia_status !== "none" && (
        <span className="inline-flex items-center rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
          LMIA {item.lmia_status}
        </span>
      )}
      {item.requires_existing_work_permit === true && (
        <span className="inline-flex items-center rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
          {isEn ? "Work permit req." : "ওয়ার্ক পারমিট দরকার"}
        </span>
      )}
      {item.source_trust_badge && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
          <ShieldCheck className="h-3 w-3" />
          {item.source_trust_badge}
        </span>
      )}
      {(item.risk_flags ?? []).length > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/20 dark:text-red-400">
          <AlertTriangle className="h-3 w-3" />
          {isEn ? `Risk: ${item.risk_flags[0]}` : `ঝুঁকি: ${item.risk_flags[0]}`}
        </span>
      )}
      {item.connector_key && (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {item.connector_key}
        </span>
      )}
    </div>
  );
}

export function AdminReviewTable({
  items: initialItems,
  isEn,
}: {
  items: DraftItem[];
  isEn: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState<number | null>(null);
  const [translating, setTranslating] = useState<number | null>(null);
  const [reExtracting, setReExtracting] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);

  const updateItemFields = (id: number, fields: Partial<DraftItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...fields } : item)));
  };

  const toggleExpand = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const doAction = async (
    id: number,
    action: "approve" | "reject" | "needs-manual-fix",
    status: ReviewStatus,
  ) => {
    setBusy(id);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/review/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(getErrorMessage(err, isEn ? "Could not update." : "আপডেট করা যায়নি।"));
        return;
      }
      const label = STATUS_LABELS[status];
      setItems((prev) =>
        prev.map((item) => item.id === id ? { ...item, review_status: status } : item)
      );
      setMessage(
        isEn
          ? `#${id} marked as ${label.en}.`
          : `#${id}: ${label.bn} হিসেবে চিহ্নিত।`,
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } finally {
      setBusy(null);
    }
  };

  const doDelete = async (id: number) => {
    const confirmed = window.confirm(
      isEn
        ? `Delete draft #${id}? This cannot be undone.`
        : `Draft #${id} মুছে ফেলবেন? এটা ফিরিয়ে আনা যাবে না।`,
    );
    if (!confirmed) return;

    setDeletingId(id);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/review/${id}`, { method: "DELETE" });
      const payload = (await res.json().catch(() => ({}))) as { message?: unknown; detail?: unknown };
      if (!res.ok) {
        setMessage(getErrorMessage(payload, isEn ? "Could not delete draft." : "ড্রাফট মুছা যায়নি।"));
        return;
      }

      setItems((prev) => prev.filter((item) => item.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (editingId === id) {
        setEditingId(null);
      }

      setMessage(getErrorMessage(payload.message, isEn ? `#${id} deleted.` : `#${id} মুছে ফেলা হয়েছে।`));
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (prev.size === items.length) {
        return new Set();
      }
      return new Set(items.map((item) => item.id));
    });
  };

  const doBulkAction = async (
    action: "approve" | "reject" | "needs-manual-fix",
    status: ReviewStatus,
  ) => {
    if (selectedIds.size === 0) {
      return;
    }

    setBulkBusy(true);
    setMessage("");
    const ids = Array.from(selectedIds);
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetch(`/api/admin/review/${id}/${action}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          });
          return { id, ok: res.ok };
        } catch {
          return { id, ok: false };
        }
      }),
    );

    const successIds = results.filter((item) => item.ok).map((item) => item.id);
    const failedIds = results.filter((item) => !item.ok).map((item) => item.id);
    const label = STATUS_LABELS[status];

    if (successIds.length > 0) {
      setItems((prev) =>
        prev.map((item) =>
          successIds.includes(item.id) ? { ...item, review_status: status } : item,
        ),
      );
    }

    setSelectedIds(new Set());
    setMessage(
      isEn
        ? `Updated ${successIds.length} item(s) as ${label.en}.${failedIds.length ? ` Failed: ${failedIds.length}.` : ""}`
        : `${successIds.length}টি আইটেম ${label.bn} করা হয়েছে।${failedIds.length ? ` ব্যর্থ: ${failedIds.length}টি।` : ""}`,
    );
    setBulkBusy(false);
  };

  const doTranslate = async (id: number) => {
    setTranslating(id);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/review/${id}/translate`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(getErrorMessage(err, isEn ? "Translation failed." : "অনুবাদ ব্যর্থ হয়েছে।"));
        return;
      }
      const updated = await res.json() as DraftItem;
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...updated } : item));
      setMessage(isEn ? `#${id} translated successfully.` : `#${id}: অনুবাদ সম্পন্ন হয়েছে।`);
    } finally {
      setTranslating(null);
    }
  };

  const doReExtract = async (id: number) => {
    setReExtracting(id);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/manual-entry/${id}/re-extract`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(getErrorMessage(err, isEn ? "AI re-extraction failed." : "AI re-extraction ব্যর্থ হয়েছে।"));
        return;
      }
      const updated = await res.json() as DraftItem;
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...updated } : item));
      setMessage(isEn ? `#${id} re-extracted with AI.` : `#${id}: AI দিয়ে আবার extraction করা হয়েছে।`);
    } finally {
      setReExtracting(null);
    }
  };

  return (
    <div className="space-y-3">
      {message && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
          {message}
        </p>
      )}

      {items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedIds.size === items.length}
              onChange={toggleSelectAll}
              disabled={bulkBusy}
              className="h-4 w-4 accent-primary"
              aria-label={isEn ? "Select all items" : "সব আইটেম নির্বাচন করুন"}
            />
            <span className="text-sm font-semibold text-foreground">
              {isEn
                ? `${selectedIds.size} selected`
                : `${selectedIds.size}টি নির্বাচন করা হয়েছে`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => doBulkAction("approve", "approved")}
              disabled={bulkBusy || selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              aria-label={isEn ? "Approve and publish selected" : "নির্বাচিত অনুমোদন ও প্রকাশ করুন"}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              {isEn ? "Approve & publish" : "অনুমোদন ও প্রকাশ"}
            </button>
            <button
              type="button"
              onClick={() => doBulkAction("reject", "rejected")}
              disabled={bulkBusy || selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-400"
              aria-label={isEn ? "Reject selected" : "নির্বাচিত প্রত্যাখ্যান"}
            >
              <XCircle className="h-3.5 w-3.5" />
              {isEn ? "Reject selected" : "নির্বাচিত প্রত্যাখ্যান"}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle className="mx-auto mb-3 h-10 w-10 text-emerald-500/50" />
          <p className="font-semibold text-foreground">
            {isEn ? "Review queue is empty" : "পর্যালোচনা সারি খালি"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEn
              ? "No items pending admin review."
              : "অ্যাডমিন পর্যালোচনার কোনো আইটেম নেই।"}
          </p>
        </Card>
      ) : (
        items.map((item) => {
          const statusInfo = STATUS_LABELS[item.review_status ?? "pending"];
          const isOpen = expanded.has(item.id);

          return (
            <article
              key={item.id}
              className="rounded-lg border border-border bg-card p-4 shadow-card"
            >
              {/* Header row */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      disabled={bulkBusy}
                      className="h-4 w-4 accent-primary"
                      aria-label={isEn ? `Select item ${item.id}` : `${item.id} নম্বর নির্বাচন করুন`}
                    />
                    <span className="text-xs font-semibold text-muted-foreground">#{item.id}</span>

                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusInfo?.cls ?? ""}`}>
                      {isEn ? statusInfo?.en : statusInfo?.bn}
                    </span>

                    {item.opportunity_type && (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {item.opportunity_type.replace(/_/g, " ")}
                      </span>
                    )}

                    {item.content_type === "image_pdf" && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                        OCR
                      </span>
                    )}
                    {item.connector_key === "manual_entry" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-900/20 dark:text-violet-400">
                        <PenLine className="h-3 w-3" />
                        ম্যানুয়াল
                      </span>
                    )}
                    {(item.content_type === "pdf" || item.content_type === "html_with_pdf") && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/20 dark:text-red-400">
                        <FileText className="h-2.5 w-2.5" />PDF
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className={`text-sm font-bold leading-snug line-clamp-2 ${confidenceClass(item.field_confidences?.title) || "text-foreground"}`}>
                    {item.title}
                  </h3>
                  {item.title_bn && (
                    <p className={`text-xs mt-0.5 line-clamp-1 ${confidenceClass(item.field_confidences?.title_bn) || "text-muted-foreground"}`}>
                      {item.title_bn}
                    </p>
                  )}

                  {/* Meta row */}
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span>{item.source_name ?? (isEn ? "Unknown source" : "অজানা উৎস")}</span>
                    {item.country && (
                      <span className={confidenceClass(item.field_confidences?.country)}>
                        📍 {item.country}
                      </span>
                    )}
                    {item.deadline && (
                      <span className={confidenceClass(item.field_confidences?.deadline_text)}>
                        ⏰ {item.deadline}
                      </span>
                    )}
                    {item.employer_or_organization && (
                      <span className={confidenceClass(item.field_confidences?.employer)}>
                        🏢 {item.employer_or_organization}
                      </span>
                    )}
                    {item.salary_text && (
                      <span className={confidenceClass(item.field_confidences?.salary)}>
                        💰 {item.salary_text}
                      </span>
                    )}
                  </div>

                  <EligibilityPills item={item} isEn={isEn} />

                  {/* Confidence + links */}
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    <span>
                      {isEn ? "Confidence:" : "আস্থা:"}{" "}
                      <span className={
                        item.extraction_confidence >= 0.7
                          ? "text-emerald-600 font-semibold"
                          : item.extraction_confidence >= 0.5
                          ? "text-amber-600 font-semibold"
                          : "text-rose-600 font-semibold"
                      }>
                        {Number(item.extraction_confidence).toFixed(2)}
                      </span>
                    </span>

                    <a
                      href={item.source_page_url || item.source_url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-0.5 hover:text-primary underline-offset-2 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {isEn ? "Source" : "উৎস"}
                    </a>

                    {item.document_url && (
                      <a
                        href={item.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-0.5 hover:text-primary underline-offset-2 hover:underline"
                      >
                        <FileText className="h-3 w-3" />PDF
                      </a>
                    )}

                    {item.raw_text && (
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="flex items-center gap-0.5 hover:text-primary"
                      >
                        {isOpen
                          ? <><EyeOff className="h-3 w-3" />{isEn ? "Hide text" : "লুকান"}</>
                          : <><Eye className="h-3 w-3" />{isEn ? "Raw text" : "মূল টেক্সট"}</>
                        }
                      </button>
                    )}
                  </div>

                  {/* Bilingual summary preview */}
                  {(item.summary_bn || item.summary_en) && (
                    <div className="mt-2 space-y-1">
                      {item.summary_bn && (
                        <p className="text-xs text-muted-foreground line-clamp-2 italic">
                          <span className="font-semibold not-italic text-foreground/60">বাং: </span>
                          {item.summary_bn}
                        </p>
                      )}
                      {item.summary_en && (
                        <p className="text-xs text-muted-foreground line-clamp-2 italic">
                          <span className="font-semibold not-italic text-foreground/60">EN: </span>
                          {item.summary_en}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Raw text (expandable) */}
                  {isOpen && item.raw_text && (
                    <pre className="mt-2 rounded border border-border bg-muted/50 p-2 text-[10px] text-muted-foreground whitespace-pre-wrap overflow-auto max-h-40">
                      {item.raw_text}
                    </pre>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
                  <button
                    onClick={() => setEditingId(editingId === item.id ? null : item.id)}
                    disabled={bulkBusy || busy === item.id || translating === item.id || reExtracting === item.id || deletingId === item.id}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:w-auto"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {editingId === item.id
                      ? (isEn ? "Close editor" : "এডিটর বন্ধ করুন")
                      : (isEn ? "Edit" : "সম্পাদনা")}
                  </button>
                  {item.review_status !== "approved" && (
                    <button
                      onClick={() => doAction(item.id, "approve", "approved")}
                      disabled={bulkBusy || busy === item.id || translating === item.id || reExtracting === item.id || deletingId === item.id}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      {isEn ? "Approve & Publish" : "অনুমোদন করুন"}
                    </button>
                  )}
                  {(!item.title_bn || !item.summary_bn || !item.summary_en) && (
                    <button
                      onClick={() => doTranslate(item.id)}
                      disabled={bulkBusy || busy === item.id || translating === item.id || reExtracting === item.id || deletingId === item.id}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-4 py-2.5 text-sm font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-50 dark:border-sky-700 dark:bg-sky-900/20 dark:text-sky-400 sm:w-auto"
                    >
                      <Languages className="h-3.5 w-3.5" />
                      {translating === item.id
                        ? (isEn ? "Translating…" : "অনুবাদ হচ্ছে…")
                        : (isEn ? "Translate Missing" : "অনুবাদ করুন")}
                    </button>
                  )}
                  {item.connector_key === "manual_entry" && item.raw_text && (
                    <button
                      onClick={() => doReExtract(item.id)}
                      disabled={bulkBusy || busy === item.id || translating === item.id || reExtracting === item.id || deletingId === item.id}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-700 dark:bg-violet-900/20 dark:text-violet-400 sm:w-auto"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {reExtracting === item.id
                        ? (isEn ? "Re-extracting..." : "আবার extraction হচ্ছে...")
                        : "Re-extract"}
                    </button>
                  )}
                  {item.review_status !== "needs_manual_fix" && (
                    <button
                      onClick={() => doAction(item.id, "needs-manual-fix", "needs_manual_fix")}
                      disabled={bulkBusy || busy === item.id || translating === item.id || reExtracting === item.id || deletingId === item.id}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400 sm:w-auto"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {isEn ? "Needs fix" : "সংশোধন দরকার"}
                    </button>
                  )}
                  {item.review_status !== "rejected" && (
                    <button
                      onClick={() => doAction(item.id, "reject", "rejected")}
                      disabled={bulkBusy || busy === item.id || translating === item.id || reExtracting === item.id || deletingId === item.id}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-400 sm:w-auto"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      {isEn ? "Reject" : "প্রত্যাখ্যান"}
                    </button>
                  )}
                  {!OFFICIAL_CONNECTORS.has(item.connector_key ?? "") && (
                  <button
                    onClick={() => doDelete(item.id)}
                    disabled={bulkBusy || busy === item.id || translating === item.id || reExtracting === item.id || deletingId === item.id}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/20 dark:text-slate-300 sm:w-auto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deletingId === item.id
                      ? (isEn ? "Deleting..." : "মুছা হচ্ছে...")
                      : (isEn ? "Delete" : "মুছুন")}
                  </button>
                  )}
                </div>
              </div>

              {/* Inline editor */}
              {editingId === item.id && (
                <InlineDraftEditor
                  item={item}
                  isEn={isEn}
                  onClose={() => setEditingId(null)}
                  onSaved={(updated) => {
                    updateItemFields(item.id, updated);
                    setMessage(isEn ? `#${item.id} updated.` : `#${item.id}: আপডেট হয়েছে।`);
                  }}
                />
              )}

              {/* Approved notice */}
              {item.review_status === "approved" && (
                <div className="mt-3 flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700/30 dark:text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {isEn
                    ? "Approved — published to public search."
                    : "অনুমোদিত — পাবলিক সার্চে প্রকাশিত হয়েছে।"}
                </div>
              )}
            </article>
          );
        })
      )}
    </div>
  );
}


function InlineDraftEditor({
  item,
  isEn,
  onClose,
  onSaved,
}: {
  item: DraftItem;
  isEn: boolean;
  onClose: () => void;
  onSaved: (updated: Partial<DraftItem>) => void;
}) {
  // Mirror the most-edited fields. The PATCH endpoint accepts more, but a
  // focused editor avoids overwhelming the reviewer.
  const [title, setTitle] = useState(item.title ?? "");
  const [titleBn, setTitleBn] = useState(item.title_bn ?? "");
  const [summaryEn, setSummaryEn] = useState(item.summary_en ?? "");
  const [summaryBn, setSummaryBn] = useState(item.summary_bn ?? "");
  const [country, setCountry] = useState(item.country ?? "");
  const [employer, setEmployer] = useState(item.employer_or_organization ?? "");
  const [deadline, setDeadline] = useState(item.deadline ?? "");
  const [salaryText, setSalaryText] = useState(item.salary_text ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    setSaving(true);
    setErr("");
    try {
      const body = {
        title: title.trim() || null,
        title_bn: titleBn.trim() || null,
        summary_en: summaryEn.trim() || null,
        summary_bn: summaryBn.trim() || null,
        country: country.trim() || null,
        employer_or_organization: employer.trim() || null,
        deadline: deadline.trim() || null,
        salary_text: salaryText.trim() || null,
      };
      const res = await fetch(`/api/admin/review/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as Partial<DraftItem> & { detail?: string };
      if (!res.ok) {
        setErr(getErrorMessage(payload, isEn ? "Save failed." : "সংরক্ষণ ব্যর্থ।"));
        return;
      }
      onSaved(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const lbl = (en: string, bn: string) => (isEn ? en : bn);

  return (
    <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-bold text-foreground">
          {isEn ? `Edit draft #${item.id}` : `Draft #${item.id} সম্পাদনা`}
        </h4>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
        >
          <X className="h-3 w-3" /> {lbl("Close", "বন্ধ")}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-foreground">{lbl("Title", "শিরোনাম")}</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">{lbl("Bangla Title", "বাংলা শিরোনাম")}</span>
            <TranslateButton
              sourceText={title}
              sourceLang="en"
              targetLang="bn"
              fieldName="title"
              onTranslated={setTitleBn}
              size="xs"
              isEn={isEn}
            />
          </div>
          <Input value={titleBn} onChange={(e) => setTitleBn(e.target.value)} />
        </label>

        <label className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">{lbl("English Summary", "ইংরেজি সারসংক্ষেপ")}</span>
            <TranslateButton
              sourceText={summaryBn}
              sourceLang="bn"
              targetLang="en"
              fieldName="summary"
              onTranslated={setSummaryEn}
              size="xs"
              isEn={isEn}
            />
          </div>
          <textarea
            value={summaryEn}
            onChange={(e) => setSummaryEn(e.target.value)}
            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">{lbl("Bangla Summary", "বাংলা সারসংক্ষেপ")}</span>
            <TranslateButton
              sourceText={summaryEn}
              sourceLang="en"
              targetLang="bn"
              fieldName="summary"
              onTranslated={setSummaryBn}
              size="xs"
              isEn={isEn}
            />
          </div>
          <textarea
            value={summaryBn}
            onChange={(e) => setSummaryBn(e.target.value)}
            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold text-foreground">{lbl("Country", "দেশ")}</span>
          <Input value={country} onChange={(e) => setCountry(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-foreground">{lbl("Employer / Org", "নিয়োগকর্তা")}</span>
          <Input value={employer} onChange={(e) => setEmployer(e.target.value)} />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold text-foreground">{lbl("Deadline (YYYY-MM-DD)", "শেষ তারিখ")}</span>
          <Input value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="2026-12-31" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-foreground">{lbl("Salary text", "বেতন")}</span>
          <Input value={salaryText} onChange={(e) => setSalaryText(e.target.value)} />
        </label>
      </div>

      {err && (
        <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">{err}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving
            ? (isEn ? "Saving..." : "সংরক্ষণ হচ্ছে...")
            : (isEn ? "Save changes" : "পরিবর্তন সংরক্ষণ")}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {lbl("Cancel", "বাতিল")}
        </button>
      </div>
    </div>
  );
}
