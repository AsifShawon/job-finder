import { AlertCircle, CheckCircle, Clock, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import type { ElementType } from "react";

import { Card } from "@/components/ui/card";
import { getLocale } from "@/lib/i18n";
import { fetchBackendJsonWithAuth } from "@/lib/server-auth-fetch";
import type { CrawlRun, CrawlRunDiagnostics, CrawlRunPage } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type CrawlRunLogs = {
  messages?: string[];
};

function StatusPill({ status, isEn }: { status: string; isEn: boolean }) {
  const map: Record<string, { icon: ElementType; className: string; label: string }> = {
    success: {
      icon: CheckCircle,
      className: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
      label: isEn ? "Success" : "সফল",
    },
    success_empty: {
      icon: CheckCircle,
      className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
      label: isEn ? "Empty" : "খালি সফল",
    },
    partial_success: {
      icon: AlertCircle,
      className: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
      label: isEn ? "Partial" : "আংশিক সফল",
    },
    failed: {
      icon: XCircle,
      className: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
      label: isEn ? "Failed" : "ব্যর্থ",
    },
    failed_config: {
      icon: XCircle,
      className: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
      label: isEn ? "Config failed" : "কনফিগ ব্যর্থ",
    },
    running: {
      icon: Loader2,
      className: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
      label: isEn ? "Running" : "চলমান",
    },
    queued: {
      icon: Clock,
      className: "bg-muted text-muted-foreground",
      label: isEn ? "Queued" : "অপেক্ষমাণ",
    },
    skipped: {
      icon: Clock,
      className: "bg-muted text-muted-foreground",
      label: isEn ? "Skipped" : "এড়ানো",
    },
    skipped_recently: {
      icon: Clock,
      className: "bg-muted text-muted-foreground",
      label: isEn ? "Skipped recently" : "সম্প্রতি এড়ানো",
    },
    skipped_compliance: {
      icon: AlertCircle,
      className: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
      label: isEn ? "Compliance" : "কমপ্লায়েন্স",
    },
    linkout_only_skipped: {
      icon: AlertCircle,
      className: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
      label: isEn ? "Linkout only" : "শুধু লিংকআউট",
    },
  };

  const config = map[status] ?? map.queued;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.className}`}>
      <Icon className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`} />
      {config.label}
    </span>
  );
}

function MetricBadge({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded px-2 py-1 text-center ${highlight && value > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-muted/40"}`}>
      <p className={`text-sm font-bold ${highlight && value > 0 ? "text-amber-700 dark:text-amber-400" : ""}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function getDiagnostics(run: CrawlRun): CrawlRunDiagnostics | null {
  return run.diagnostics ?? null;
}

function getMessages(run: CrawlRun): string[] {
  const logs = run.logs as CrawlRunLogs | null;
  return Array.isArray(logs?.messages) ? logs.messages : [];
}

function formatReason(reason: string) {
  return reason.replace(/^strict_/, "").replaceAll("_", " ");
}

function DiagnosticsPanel({ run, isEn }: { run: CrawlRun; isEn: boolean }) {
  const diagnostics = getDiagnostics(run);
  const messages = getMessages(run);
  const skipReasons = Object.entries(diagnostics?.skip_reasons ?? {});
  const rawItemsHref = diagnostics?.dominant_skip_reason
    ? `/admin/raw-items?crawl_run_id=${run.id}&skip_reason=${encodeURIComponent(diagnostics.dominant_skip_reason)}`
    : `/admin/raw-items?crawl_run_id=${run.id}`;

  if (!diagnostics && messages.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <details className="group max-w-[320px] text-xs">
      <summary className="cursor-pointer list-none text-muted-foreground underline-offset-4 group-open:text-foreground group-open:underline [&::-webkit-details-marker]:hidden">
        {isEn ? "View diagnostics" : "ডায়াগনস্টিকস দেখুন"}
      </summary>
      <div className="mt-2 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
        {diagnostics ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <MetricBadge label={isEn ? "Accepted" : "গৃহীত"} value={diagnostics.accepted_count} />
              <MetricBadge label={isEn ? "Published" : "প্রকাশিত"} value={diagnostics.published_count} />
              <MetricBadge label={isEn ? "Skipped" : "স্কিপ"} value={diagnostics.skipped_count} highlight />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MetricBadge label={isEn ? "Low conf review" : "লো কনফ রিভিউ"} value={diagnostics.low_confidence_review_count} highlight />
              <MetricBadge label={isEn ? "High conf published" : "হাই কনফ প্রকাশ"} value={diagnostics.high_confidence_published_count} />
            </div>
            {skipReasons.length > 0 ? (
              <div className="space-y-1">
                <p className="font-semibold text-foreground">{isEn ? "Skip reasons" : "স্কিপ কারণ"}</p>
                <div className="space-y-1">
                  {skipReasons.map(([reason, count]) => (
                    <div key={reason} className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">{formatReason(reason)}</span>
                      <span className="font-semibold text-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {diagnostics.dominant_skip_reason ? (
              <div className="space-y-1">
                <p className="font-semibold text-foreground">{isEn ? "Dominant reason" : "প্রধান কারণ"}</p>
                <p className="text-muted-foreground">{formatReason(diagnostics.dominant_skip_reason)}</p>
              </div>
            ) : null}
            {Object.keys(diagnostics.confidence_summary ?? {}).length > 0 ? (
              <div className="space-y-1">
                <p className="font-semibold text-foreground">{isEn ? "Confidence" : "কনফিডেন্স"}</p>
                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <span>min {diagnostics.confidence_summary.min ?? "—"}</span>
                  <span>max {diagnostics.confidence_summary.max ?? "—"}</span>
                  <span>median {diagnostics.confidence_summary.median ?? "—"}</span>
                  <span>count {diagnostics.confidence_summary.count ?? "—"}</span>
                </div>
              </div>
            ) : null}
            {Object.keys(diagnostics.extraction_method_counts ?? {}).length > 0 ? (
              <div className="space-y-1">
                <p className="font-semibold text-foreground">{isEn ? "Extraction paths" : "এক্সট্রাকশন পাথ"}</p>
                <div className="space-y-1 text-muted-foreground">
                  {Object.entries(diagnostics.extraction_method_counts).map(([method, count]) => (
                    <div key={method} className="flex items-start justify-between gap-3">
                      <span>{method.replaceAll("_", " ")}</span>
                      <span className="font-semibold text-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
        <a href={rawItemsHref} className="inline-flex text-xs font-medium text-primary hover:underline">
          {isEn ? "Inspect raw items" : "মূল আইটেম দেখুন"}
        </a>
        {messages.length > 0 ? (
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{isEn ? "Recent logs" : "সাম্প্রতিক লগ"}</p>
            <div className="space-y-1 text-muted-foreground">
              {messages.slice(-4).map((message, idx) => (
                <p key={`${run.id}-${idx}`} className="break-words">
                  {message}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}

export default async function AdminCrawlsPage() {
  const locale = await getLocale();
  const isEn = locale === "en";

  const data =
    (await fetchBackendJsonWithAuth<CrawlRunPage>("/api/v1/admin/crawl-runs")) ??
    { items: [], total: 0, page: 1, page_size: 20 };

  const stats = {
    total: data.total,
    success: data.items.filter((c) => c.status === "success").length,
    partial: data.items.filter((c) => c.status === "partial_success").length,
    failed: data.items.filter((c) => c.status === "failed" || c.status === "failed_config").length,
    running: data.items.filter((c) => c.status === "running").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {isEn ? "Pipeline Monitoring" : "পাইপলাইন পর্যবেক্ষণ"}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">
          {isEn ? "Crawl Runs" : "ক্রল রান তালিকা"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEn
            ? "Monitor recent crawl results with found-item, skipped, import, and failure diagnostics."
            : "সাম্প্রতিক ক্রল রানের found, skipped, import ও ব্যর্থতার ডায়াগনস্টিকস দেখুন।"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: isEn ? "Total" : "মোট", value: stats.total, className: "text-foreground" },
          { label: isEn ? "Successful" : "সফল", value: stats.success, className: "text-green-600" },
          { label: isEn ? "Partial" : "আংশিক", value: stats.partial, className: "text-amber-600" },
          { label: isEn ? "Failed" : "ব্যর্থ", value: stats.failed, className: "text-red-600" },
          { label: isEn ? "Running" : "চলমান", value: stats.running, className: "text-blue-600" },
        ].map(({ label, value, className }) => (
          <Card key={label} className="py-4 text-center">
            <p className={`text-2xl font-bold ${className}`}>{value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {[
                  "ID",
                  isEn ? "Source" : "উৎস",
                  isEn ? "Connector" : "কানেক্টর",
                  isEn ? "Status" : "অবস্থা",
                  isEn ? "Started" : "শুরু",
                  isEn ? "Found" : "আবিষ্কৃত",
                  isEn ? "Parsed" : "পার্স",
                  isEn ? "Drafts+" : "ড্রাফট+",
                  isEn ? "Dupes" : "ডুপ্লিকেট",
                  isEn ? "Skipped" : "স্কিপ",
                  isEn ? "Failed" : "ব্যর্থ",
                  isEn ? "Diagnostics" : "ডায়াগনস্টিকস",
                  isEn ? "Inspect" : "ইনস্পেক্ট",
                  isEn ? "Error" : "ত্রুটি",
                ].map((header) => (
                  <th
                    key={header}
                    className="whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {isEn ? "No crawl runs found." : "কোনো ক্রল রান নেই।"}
                  </td>
                </tr>
              ) : (
                data.items.map((run) => (
                  <tr key={run.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">#{run.id}</td>
                    <td className="max-w-[160px] truncate px-3 py-3 font-medium text-foreground">
                      {run.source_name ?? `#${run.source_id}`}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {run.connector_key ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={run.status} isEn={isEn} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                      {formatDateTime(run.started_at, locale)}
                    </td>
                    <td className="px-3 py-3 text-center text-xs">{run.discovered_count}</td>
                    <td className="px-3 py-3 text-center text-xs">{run.parsed_count}</td>
                    <td className="px-3 py-3 text-center text-xs font-semibold text-green-700 dark:text-green-400">
                      +{run.draft_created_count}
                      {run.draft_updated_count > 0 ? (
                        <span className="font-normal text-muted-foreground"> /{run.draft_updated_count}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-center text-xs text-muted-foreground">{run.duplicate_count}</td>
                    <td className={`px-3 py-3 text-center text-xs ${run.skipped_count > 0 ? "font-semibold text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
                      {run.skipped_count}
                    </td>
                    <td className={`px-3 py-3 text-center text-xs ${run.failed_count > 0 ? "font-semibold text-red-600" : ""}`}>
                      {run.failed_count}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <DiagnosticsPanel run={run} isEn={isEn} />
                    </td>
                    <td className="px-3 py-3 align-top">
                      <Link
                        href={`/admin/crawls/${run.id}/inspection` as Route}
                        className="inline-flex rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        {isEn ? "Inspect run" : "রান দেখুন"}
                      </Link>
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-3 text-xs text-red-500">
                      {run.error_message ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-border lg:hidden">
          {data.items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {isEn ? "No crawl runs found." : "কোনো ক্রল রান নেই।"}
            </div>
          ) : (
            data.items.map((run) => (
              <div key={run.id} className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {run.source_name ?? `Source #${run.source_id}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      #{run.id} · {run.connector_key ?? "—"} · {formatDateTime(run.started_at, locale)}
                    </p>
                  </div>
                  <StatusPill status={run.status} isEn={isEn} />
                </div>
                <div className="grid grid-cols-6 gap-1">
                  <MetricBadge label={isEn ? "Found" : "আবিষ্কৃত"} value={run.discovered_count} />
                  <MetricBadge label={isEn ? "Parse" : "পার্স"} value={run.parsed_count} />
                  <MetricBadge label={isEn ? "Draft+" : "ড্রাফট+"} value={run.draft_created_count} />
                  <MetricBadge label={isEn ? "Dupe" : "ডুপ"} value={run.duplicate_count} />
                  <MetricBadge label={isEn ? "Skip" : "স্কিপ"} value={run.skipped_count} highlight />
                  <MetricBadge label={isEn ? "Fail" : "ব্যর্থ"} value={run.failed_count} highlight />
                </div>
                <DiagnosticsPanel run={run} isEn={isEn} />
                <Link
                  href={`/admin/crawls/${run.id}/inspection` as Route}
                  className="inline-flex rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {isEn ? "Open inspection" : "ইনস্পেকশন খুলুন"}
                </Link>
                {run.error_message ? (
                  <p className="text-xs text-red-500">Warning: {run.error_message}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
