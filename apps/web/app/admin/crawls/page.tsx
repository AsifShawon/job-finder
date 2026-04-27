import { Activity, CheckCircle, XCircle, Loader2, Clock, AlertCircle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getLocale } from "@/lib/i18n";
import { fetchBackendJsonWithAuth } from "@/lib/server-auth-fetch";
import type { CrawlRunPage } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { icon: React.ElementType; className: string; label: string }> = {
    success: {
      icon: CheckCircle,
      className: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
      label: "সফল",
    },
    partial_success: {
      icon: AlertCircle,
      className: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
      label: "আংশিক সফল",
    },
    failed: {
      icon: XCircle,
      className: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
      label: "ব্যর্থ",
    },
    running: {
      icon: Loader2,
      className: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
      label: "চলমান",
    },
    queued: {
      icon: Clock,
      className: "bg-muted text-muted-foreground",
      label: "অপেক্ষমাণ",
    },
  };

  const config = map[status] ?? map.queued;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.className}`}
    >
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
    failed: data.items.filter((c) => c.status === "failed").length,
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
            ? "Monitor recent crawl results with per-run discovery, draft creation, and failure metrics."
            : "সাম্প্রতিক ক্রল রানের ফলাফল, ড্রাফট তৈরি ও ব্যর্থতার বিবরণ দেখুন।"}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: isEn ? "Total" : "মোট", value: stats.total, className: "text-foreground" },
          { label: isEn ? "Successful" : "সফল", value: stats.success, className: "text-green-600" },
          { label: isEn ? "Partial" : "আংশিক", value: stats.partial, className: "text-amber-600" },
          { label: isEn ? "Failed" : "ব্যর্থ", value: stats.failed, className: "text-red-600" },
          { label: isEn ? "Running" : "চলমান", value: stats.running, className: "text-blue-600" },
        ].map(({ label, value, className }) => (
          <Card key={label} className="text-center py-4">
            <p className={`text-2xl font-bold ${className}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </Card>
        ))}
      </div>

      {/* Crawl run list — desktop table */}
      <Card className="p-0 overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {[
                  "ID", isEn ? "Source" : "উৎস", isEn ? "Connector" : "কানেক্টর",
                  isEn ? "Status" : "অবস্থা", isEn ? "Started" : "শুরু",
                  isEn ? "Disc." : "আবিষ্কৃত", isEn ? "Parsed" : "পার্স",
                  isEn ? "Drafts+" : "ড্রাফট+", isEn ? "Dupes" : "ডুপ্লিকেট",
                  isEn ? "Failed" : "ব্যর্থ", isEn ? "Error" : "ত্রুটি",
                ].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    {isEn ? "No crawl runs found." : "কোনো ক্রল রান নেই।"}
                  </td>
                </tr>
              ) : (
                data.items.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">#{c.id}</td>
                    <td className="px-3 py-3 font-medium text-foreground max-w-[140px] truncate">
                      {c.source_name ?? `#${c.source_id}`}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {c.connector_key ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={c.status} />
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(c.started_at, locale)}
                    </td>
                    <td className="px-3 py-3 text-xs text-center">{c.discovered_count}</td>
                    <td className="px-3 py-3 text-xs text-center">{c.parsed_count}</td>
                    <td className="px-3 py-3 text-xs text-center font-semibold text-green-700 dark:text-green-400">
                      +{c.draft_created_count}
                      {c.draft_updated_count > 0 && (
                        <span className="text-muted-foreground font-normal"> /{c.draft_updated_count}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-center text-muted-foreground">{c.duplicate_count}</td>
                    <td className={`px-3 py-3 text-xs text-center ${c.failed_count > 0 ? "text-red-600 font-semibold" : ""}`}>
                      {c.failed_count}
                    </td>
                    <td className="px-3 py-3 text-xs text-red-500 max-w-[160px] truncate">
                      {c.error_message ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="divide-y divide-border lg:hidden">
          {data.items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {isEn ? "No crawl runs found." : "কোনো ক্রল রান নেই।"}
            </div>
          ) : (
            data.items.map((c) => (
              <div key={c.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      {c.source_name ?? `Source #${c.source_id}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      #{c.id} · {c.connector_key ?? "—"} · {formatDateTime(c.started_at, locale)}
                    </p>
                  </div>
                  <StatusPill status={c.status} />
                </div>
                <div className="grid grid-cols-5 gap-1">
                  <MetricBadge label={isEn ? "Disc" : "আবিষ্কৃত"} value={c.discovered_count} />
                  <MetricBadge label={isEn ? "Parse" : "পার্স"} value={c.parsed_count} />
                  <MetricBadge label={isEn ? "Draft+" : "ড্রাফট+"} value={c.draft_created_count} />
                  <MetricBadge label={isEn ? "Dupe" : "ডুপ"} value={c.duplicate_count} />
                  <MetricBadge label={isEn ? "Fail" : "ব্যর্থ"} value={c.failed_count} highlight />
                </div>
                {c.error_message && (
                  <p className="text-xs text-red-500">⚠ {c.error_message}</p>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
