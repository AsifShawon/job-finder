import { FileText } from "lucide-react";

import { Card } from "@/components/ui/card";
import { fetchBackendJsonWithAuth } from "@/lib/server-auth-fetch";
import { getLocale } from "@/lib/i18n";
import type { RawDocument, RawDocumentPage } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

interface AdminRawItemsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function buildApiPath(params: { crawlRunId: string; sourceId: string; skipReason: string }) {
  const query = new URLSearchParams({ page_size: "50" });
  if (params.crawlRunId) {
    query.set("crawl_run_id", params.crawlRunId);
  }
  if (params.sourceId) {
    query.set("source_id", params.sourceId);
  }
  if (params.skipReason) {
    query.set("skip_reason", params.skipReason);
  }
  return `/api/v1/admin/raw-documents?${query.toString()}`;
}

function excerpt(text: string | null | undefined, maxLength = 280) {
  if (!text) {
    return "—";
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}…`;
}

function formatSkipReason(reason: string | null | undefined) {
  if (!reason) {
    return "—";
  }
  return reason.replace(/^strict_/, "").replaceAll("_", " ");
}

function ExtractionDetails({ item }: { item: RawDocument }) {
  const attempts = item.extraction_diagnostics_json?.attempts ?? [];
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-xs font-medium text-primary underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
        Inspect
      </summary>
      <div className="mt-2 space-y-3 rounded-lg border border-border bg-muted/30 p-3 text-xs">
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <p className="font-semibold text-foreground">Skip reason</p>
            <p className="text-muted-foreground">{formatSkipReason(item.skip_reason)}</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Raw excerpt</p>
            <p className="text-muted-foreground">{excerpt(item.raw_text)}</p>
          </div>
        </div>

        {attempts.length > 0 ? (
          <div className="space-y-3">
            <p className="font-semibold text-foreground">Extraction attempts</p>
            {attempts.map((attempt, idx) => (
              <div key={`${item.id}-${idx}`} className="space-y-2 rounded border border-border bg-background/80 p-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <p className="font-semibold text-foreground">Type</p>
                    <p className="text-muted-foreground">{attempt.record_type ?? "—"}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Confidence</p>
                    <p className="text-muted-foreground">{attempt.extraction_confidence ?? "—"}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Application URL</p>
                    <p className="break-all text-muted-foreground">{attempt.application_url ?? "—"}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Employer / Country</p>
                    <p className="text-muted-foreground">{attempt.employer ?? "—"} / {attempt.country ?? "—"}</p>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Title</p>
                  <p className="text-muted-foreground">{attempt.title ?? "—"}</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Summary</p>
                  <p className="text-muted-foreground">{excerpt(attempt.summary, 360)}</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Skip reason</p>
                  <p className="text-muted-foreground">{formatSkipReason(attempt.skip_reason)}</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Field confidences</p>
                  <pre className="overflow-x-auto rounded bg-muted/60 p-2 text-[11px] text-muted-foreground">
                    {JSON.stringify(attempt.field_confidences ?? {}, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Evidence snippets</p>
                  <pre className="overflow-x-auto rounded bg-muted/60 p-2 text-[11px] text-muted-foreground">
                    {JSON.stringify(attempt.evidence_snippets ?? [], null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Validation errors</p>
                  <pre className="overflow-x-auto rounded bg-muted/60 p-2 text-[11px] text-muted-foreground">
                    {JSON.stringify(attempt.validation_errors ?? [], null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No extraction diagnostics recorded.</p>
        )}
      </div>
    </details>
  );
}

export default async function AdminRawItemsPage({ searchParams }: AdminRawItemsPageProps) {
  const [locale, params] = await Promise.all([getLocale(), searchParams]);
  const isEn = locale === "en";
  const crawlRunId = firstParam(params.crawl_run_id);
  const sourceId = firstParam(params.source_id);
  const skipReason = firstParam(params.skip_reason);
  const apiPath = buildApiPath({ crawlRunId, sourceId, skipReason });

  const data = await fetchBackendJsonWithAuth<RawDocumentPage>(apiPath);
  const page = data ?? { items: [], total: 0, page: 1, page_size: 50 };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {isEn ? "Audit Trail" : "অডিট ট্রেইল"}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">
          {isEn ? "Raw Crawl Items" : "মূল ক্রল আইটেম"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEn
            ? "Inspect skipped and accepted raw crawl records, extraction attempts, and page excerpts."
            : "স্কিপ ও গ্রহণ করা raw crawl record, extraction attempt এবং page excerpt দেখুন।"}
        </p>
      </div>

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-4" method="GET">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">{isEn ? "Crawl run ID" : "ক্রল রান আইডি"}</span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              name="crawl_run_id"
              defaultValue={crawlRunId}
              placeholder="34"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">{isEn ? "Source ID" : "সোর্স আইডি"}</span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              name="source_id"
              defaultValue={sourceId}
              placeholder="7"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">{isEn ? "Skip reason" : "স্কিপ কারণ"}</span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              name="skip_reason"
              defaultValue={skipReason}
              placeholder="strict_low_ai_confidence"
            />
          </label>
          <div className="flex items-end gap-2">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" type="submit">
              {isEn ? "Apply" : "প্রয়োগ"}
            </button>
            <a className="text-sm text-muted-foreground hover:underline" href="/admin/raw-items">
              {isEn ? "Reset" : "রিসেট"}
            </a>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {[
                  "ID",
                  isEn ? "Title" : "শিরোনাম",
                  "URL",
                  isEn ? "Type" : "ধরণ",
                  isEn ? "Skip reason" : "স্কিপ কারণ",
                  isEn ? "Confidence" : "কনফিডেন্স",
                  isEn ? "Fetched" : "ক্রল সময়",
                  isEn ? "Inspect" : "ইনস্পেক্ট",
                ].map((header) => (
                  <th key={header} className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {page.items.map((item) => {
                const firstAttempt = item.extraction_diagnostics_json?.attempts?.[0];
                return (
                  <tr key={item.id} className="align-top">
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">#{item.id}</td>
                    <td className="max-w-[240px] px-3 py-3">
                      <div className="flex items-start gap-2">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div>
                          <span className="font-medium line-clamp-2">{item.raw_title ?? "Untitled"}</span>
                          {item.source_job_id ? (
                            <p className="mt-1 text-xs text-muted-foreground">Job ID: {item.source_job_id}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[260px] px-3 py-3">
                      <a href={item.source_url} target="_blank" rel="noreferrer" className="break-all text-xs text-primary hover:underline">
                        {item.source_url}
                      </a>
                    </td>
                    <td className="px-3 py-3 text-xs">{item.detected_item_type ?? item.content_type ?? "unknown"}</td>
                    <td className="max-w-[220px] px-3 py-3 text-xs text-amber-700">{item.skip_reason ?? "—"}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {firstAttempt?.extraction_confidence ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">{formatDateTime(item.fetched_at, locale)}</td>
                    <td className="px-3 py-3">
                      <ExtractionDetails item={item} />
                    </td>
                  </tr>
                );
              })}
              {page.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {isEn ? "No raw crawl items found." : "কোনো মূল ক্রল আইটেম নেই।"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
