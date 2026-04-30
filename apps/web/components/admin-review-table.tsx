"use client";

import { useState } from "react";
import {
  AlertTriangle, CheckCircle, ExternalLink, FileText,
  ShieldCheck, XCircle, Eye, EyeOff, Languages,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

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
        setMessage((err as { detail?: string }).detail || (isEn ? "Could not update." : "আপডেট করা যায়নি।"));
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
    } finally {
      setBusy(null);
    }
  };

  const doTranslate = async (id: number) => {
    setTranslating(id);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/review/${id}/translate`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage((err as { detail?: string }).detail || (isEn ? "Translation failed." : "অনুবাদ ব্যর্থ হয়েছে।"));
        return;
      }
      const updated = await res.json() as DraftItem;
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...updated } : item));
      setMessage(isEn ? `#${id} translated successfully.` : `#${id}: অনুবাদ সম্পন্ন হয়েছে।`);
    } finally {
      setTranslating(null);
    }
  };

  return (
    <div className="space-y-3">
      {message && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
          {message}
        </p>
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
                    {(item.content_type === "pdf" || item.content_type === "html_with_pdf") && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/20 dark:text-red-400">
                        <FileText className="h-2.5 w-2.5" />PDF
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-2">
                    {item.title}
                  </h3>
                  {item.title_bn && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.title_bn}</p>
                  )}

                  {/* Meta row */}
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span>{item.source_name ?? (isEn ? "Unknown source" : "অজানা উৎস")}</span>
                    {item.country && <span>📍 {item.country}</span>}
                    {item.deadline && <span>⏰ {item.deadline}</span>}
                    {item.employer_or_organization && (
                      <span>🏢 {item.employer_or_organization}</span>
                    )}
                    {item.salary_text && <span>💰 {item.salary_text}</span>}
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
                <div className="flex shrink-0 flex-col gap-2 items-end">
                  {item.review_status !== "approved" && (
                    <button
                      onClick={() => doAction(item.id, "approve", "approved")}
                      disabled={busy === item.id || translating === item.id}
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      {isEn ? "Approve & Publish" : "অনুমোদন করুন"}
                    </button>
                  )}
                  {(!item.title_bn || !item.summary_bn || !item.summary_en) && (
                    <button
                      onClick={() => doTranslate(item.id)}
                      disabled={busy === item.id || translating === item.id}
                      className="inline-flex items-center gap-1.5 rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-50 dark:border-sky-700 dark:bg-sky-900/20 dark:text-sky-400"
                    >
                      <Languages className="h-3.5 w-3.5" />
                      {translating === item.id
                        ? (isEn ? "Translating…" : "অনুবাদ হচ্ছে…")
                        : (isEn ? "Translate Missing" : "অনুবাদ করুন")}
                    </button>
                  )}
                  {item.review_status !== "needs_manual_fix" && (
                    <button
                      onClick={() => doAction(item.id, "needs-manual-fix", "needs_manual_fix")}
                      disabled={busy === item.id || translating === item.id}
                      className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {isEn ? "Needs fix" : "সংশোধন দরকার"}
                    </button>
                  )}
                  {item.review_status !== "rejected" && (
                    <button
                      onClick={() => doAction(item.id, "reject", "rejected")}
                      disabled={busy === item.id || translating === item.id}
                      className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-400"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      {isEn ? "Reject" : "প্রত্যাখ্যান"}
                    </button>
                  )}
                </div>
              </div>

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
