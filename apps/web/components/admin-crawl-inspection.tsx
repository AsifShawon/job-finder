"use client";

import { useEffect, useState, useTransition } from "react";

import { Card } from "@/components/ui/card";
import type { CrawlRunInspection, RawDocumentActionResult, RawDocumentInspection } from "@/lib/types";

type TabKey = "overview" | "pages" | "parser" | "input" | "output" | "preview";

interface AdminCrawlInspectionProps {
  initialRun: CrawlRunInspection;
  locale: "bn" | "en";
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }
  return response.json() as Promise<T>;
}

function pretty(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function AdminCrawlInspection({ initialRun, locale }: AdminCrawlInspectionProps) {
  const isEn = locale === "en";
  const [run, setRun] = useState(initialRun);
  const [selectedRawId, setSelectedRawId] = useState<number | null>(initialRun.pages[0]?.raw_document_id ?? null);
  const [inspection, setInspection] = useState<RawDocumentInspection | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [parserJson, setParserJson] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedRawId) return;
    startTransition(() => {
      fetchJson<RawDocumentInspection>(`/api/admin/raw-documents/${selectedRawId}/inspection`)
        .then((data) => {
          setInspection(data);
          setParserJson(pretty((data.section_parser as { parsed_payload?: unknown } | undefined)?.parsed_payload ?? {}));
        })
        .catch((error: Error) => setMessage(error.message));
    });
  }, [selectedRawId]);

  function refreshRun() {
    startTransition(() => {
      fetchJson<CrawlRunInspection>(`/api/admin/crawl-runs/${run.run_id}/inspection`)
        .then(setRun)
        .catch((error: Error) => setMessage(error.message));
    });
  }

  function runAction(path: string, body?: unknown) {
    if (!selectedRawId) return;
    setMessage(null);
    startTransition(() => {
      fetchJson<RawDocumentActionResult>(path, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      })
        .then(async () => {
          const [nextInspection, nextRun] = await Promise.all([
            fetchJson<RawDocumentInspection>(`/api/admin/raw-documents/${selectedRawId}/inspection`),
            fetchJson<CrawlRunInspection>(`/api/admin/crawl-runs/${run.run_id}/inspection`),
          ]);
          setInspection(nextInspection);
          setRun(nextRun);
          setParserJson(pretty((nextInspection.section_parser as { parsed_payload?: unknown } | undefined)?.parsed_payload ?? {}));
          setMessage(isEn ? "Updated." : "আপডেট হয়েছে।");
        })
        .catch((error: Error) => setMessage(error.message));
    });
  }

  const preview = inspection?.validated_ai_output ?? {};
  const parserPayload = (inspection?.section_parser as { parsed_payload?: Record<string, unknown> } | undefined)?.parsed_payload ?? {};

  function saveParserEdits() {
    try {
      const parsed = JSON.parse(parserJson);
      runAction(`/api/admin/raw-documents/${inspection?.raw_document_id}/save-parser-edits`, { parsed_payload: parsed });
    } catch {
      setMessage(isEn ? "Parsed JSON is invalid." : "Parsed JSON invalid.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          [isEn ? "Pages discovered" : "পেজ পাওয়া গেছে", run.pages_discovered],
          [isEn ? "Detail pages" : "ডিটেইল পেজ", run.detail_pages_followed],
          [isEn ? "Parser success" : "পার্সার সফল", run.parser_success_count],
          [isEn ? "AI success" : "AI সফল", run.ai_success_count],
          [isEn ? "Failed" : "ব্যর্থ", run.failed_count],
          [isEn ? "Pending review" : "রিভিউ বাকি", run.pending_admin_review_count],
        ].map(([label, value]) => (
          <Card key={String(label)} className="py-4 text-center">
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">{run.source_name}</h1>
            <p className="text-sm text-muted-foreground">
              {run.connector_key} · {run.crawl_status}
            </p>
            <p className="text-xs text-muted-foreground">{run.source_url}</p>
          </div>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-2 text-sm font-medium"
            onClick={refreshRun}
            disabled={isPending}
          >
            {isEn ? "Refresh" : "রিফ্রেশ"}
          </button>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {([
          ["overview", isEn ? "Crawl Overview" : "ক্লল ওভারভিউ"],
          ["pages", isEn ? "Scraped Pages" : "স্ক্র্যাপড পেজ"],
          ["parser", isEn ? "Regex Section Output" : "সেকশন আউটপুট"],
          ["input", isEn ? "AI Input" : "AI ইনপুট"],
          ["output", isEn ? "AI Output" : "AI আউটপুট"],
          ["preview", isEn ? "Final Preview" : "ফাইনাল প্রিভিউ"],
        ] as Array<[TabKey, string]>).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${tab === key ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {message ? (
        <Card>
          <p className="text-sm text-foreground">{message}</p>
        </Card>
      ) : null}

      {tab === "overview" && (
        <Card>
          <div className="space-y-3 text-sm">
            <p><strong>{isEn ? "Started" : "শুরু"}:</strong> {run.started_at ?? "—"}</p>
            <p><strong>{isEn ? "Finished" : "শেষ"}:</strong> {run.finished_at ?? "—"}</p>
            <p><strong>{isEn ? "Discovery diagnostics" : "ডিসকভারি ডায়াগনস্টিকস"}:</strong></p>
            <pre className="overflow-x-auto rounded bg-muted/60 p-3 text-xs">{pretty(run.discovery_diagnostics)}</pre>
            <p><strong>{isEn ? "Extraction method counts" : "এক্সট্রাকশন কাউন্ট"}:</strong></p>
            <pre className="overflow-x-auto rounded bg-muted/60 p-3 text-xs">{pretty(run.extraction_method_counts)}</pre>
            <p><strong>{isEn ? "Skip reasons" : "স্কিপ কারণ"}:</strong></p>
            <pre className="overflow-x-auto rounded bg-muted/60 p-3 text-xs">{pretty(run.skip_reasons)}</pre>
            <p><strong>{isEn ? "Fallback reasons" : "ফলব্যাক কারণ"}:</strong></p>
            <pre className="overflow-x-auto rounded bg-muted/60 p-3 text-xs">{pretty(run.fallback_reasons)}</pre>
            <p><strong>{isEn ? "Run logs" : "রান লগ"}:</strong></p>
            <pre className="overflow-x-auto rounded bg-muted/60 p-3 text-xs">{pretty(run.run_logs)}</pre>
          </div>
        </Card>
      )}

      {tab === "pages" && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {[
                    isEn ? "Job title" : "জব টাইটেল",
                    "URL",
                    isEn ? "Final URL" : "ফাইনাল URL",
                    isEn ? "Text len" : "টেক্সট দৈর্ঘ্য",
                    "HTML",
                    isEn ? "Parser" : "পার্সার",
                    "AI",
                    isEn ? "Publish" : "পাবলিশ",
                    isEn ? "Inspect" : "ইনস্পেক্ট",
                  ].map((header) => (
                    <th key={header} className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {run.pages.map((page) => (
                  <tr key={page.raw_document_id}>
                    <td className="px-3 py-3">{page.title ?? "Untitled"}</td>
                    <td className="max-w-[260px] break-all px-3 py-3 text-xs text-muted-foreground">{page.source_url}</td>
                    <td className="max-w-[260px] break-all px-3 py-3 text-xs text-muted-foreground">{page.final_url ?? "—"}</td>
                    <td className="px-3 py-3">{page.raw_text_length}</td>
                    <td className="px-3 py-3">{page.html_captured ? "true" : "false"}</td>
                    <td className="px-3 py-3">{page.parser_status ?? "—"}</td>
                    <td className="px-3 py-3">{page.ai_status ?? "—"}</td>
                    <td className="px-3 py-3">{page.publish_status ?? "—"}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        className="rounded-md border border-border px-3 py-1 text-xs"
                        onClick={() => {
                          setSelectedRawId(page.raw_document_id);
                          setTab("parser");
                        }}
                      >
                        {isEn ? "Inspect" : "দেখুন"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {inspection && tab === "parser" && (
        <Card>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground" onClick={() => runAction(`/api/admin/raw-documents/${inspection.raw_document_id}/parse-sections`)} disabled={isPending}>
                {isEn ? "Send back to parser" : "পার্সারে ফেরত পাঠান"}
              </button>
              <button type="button" className="rounded-md border border-border px-3 py-2 text-sm font-medium" onClick={() => runAction(`/api/admin/raw-documents/${inspection.raw_document_id}/run-ai`)} disabled={isPending}>
                {isEn ? "Continue to AI" : "AI-তে পাঠান"}
              </button>
            </div>
            <pre className="max-h-[520px] overflow-auto rounded bg-muted/60 p-3 text-xs">{pretty(inspection.section_parser)}</pre>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">{isEn ? "Edit parsed JSON" : "পার্সড JSON এডিট"}</span>
              <textarea
                className="min-h-[320px] w-full rounded-md border border-border bg-background p-3 font-mono text-xs"
                value={parserJson}
                onChange={(event) => setParserJson(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-2 text-sm font-medium"
              onClick={saveParserEdits}
              disabled={isPending}
            >
              {isEn ? "Save parser edits" : "পার্সার এডিট সেভ করুন"}
            </button>
          </div>
        </Card>
      )}

      {inspection && tab === "input" && (
        <Card>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground" onClick={() => runAction(`/api/admin/raw-documents/${inspection.raw_document_id}/run-ai`)} disabled={isPending}>
                {isEn ? "Run AI extraction" : "AI এক্সট্রাকশন চালান"}
              </button>
              <button type="button" className="rounded-md border border-border px-3 py-2 text-sm font-medium" onClick={() => navigator.clipboard.writeText(pretty(inspection.compact_ai_input))} disabled={isPending}>
                {isEn ? "Copy AI input" : "AI ইনপুট কপি"}
              </button>
            </div>
            <pre className="max-h-[520px] overflow-auto rounded bg-muted/60 p-3 text-xs">{pretty(inspection.compact_ai_input)}</pre>
          </div>
        </Card>
      )}

      {inspection && tab === "output" && (
        <Card>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground" onClick={() => runAction(`/api/admin/raw-documents/${inspection.raw_document_id}/run-ai`)} disabled={isPending}>
                {isEn ? "Re-run AI extraction" : "AI আবার চালান"}
              </button>
              <button type="button" className="rounded-md border border-border px-3 py-2 text-sm font-medium" onClick={() => runAction(`/api/admin/raw-documents/${inspection.raw_document_id}/use-fallback`)} disabled={isPending}>
                {isEn ? "Use deterministic fallback" : "ডিটারমিনিস্টিক ফলব্যাক ব্যবহার করুন"}
              </button>
            </div>
            <p className="text-sm font-medium text-foreground">{isEn ? "Raw AI JSON" : "র' AI JSON"}</p>
            <pre className="max-h-[240px] overflow-auto rounded bg-muted/60 p-3 text-xs">{pretty(inspection.raw_ai_output)}</pre>
            <p className="text-sm font-medium text-foreground">{isEn ? "Validated JSON" : "ভ্যালিডেটেড JSON"}</p>
            <pre className="max-h-[320px] overflow-auto rounded bg-muted/60 p-3 text-xs">{pretty(inspection.validated_ai_output)}</pre>
            <p className="text-sm font-medium text-foreground">{isEn ? "Warnings" : "ওয়ার্নিং"}</p>
            <pre className="overflow-auto rounded bg-muted/60 p-3 text-xs">{pretty(inspection.warnings)}</pre>
          </div>
        </Card>
      )}

      {inspection && tab === "preview" && (
        <Card>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground" onClick={() => runAction(`/api/admin/raw-documents/${inspection.raw_document_id}/publish`)} disabled={isPending}>
                {isEn ? "Publish" : "পাবলিশ"}
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{isEn ? "Title" : "শিরোনাম"}</p>
                <p className="text-lg font-bold text-foreground">{String(preview.title ?? "—")}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{isEn ? "Application URL" : "আবেদন লিংক"}</p>
                <p className="break-all text-sm text-foreground">{String(preview.application_url ?? "—")}</p>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Bangla</p>
              <p className="text-sm text-foreground">{String(preview.summary_bn ?? "—")}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">English</p>
              <p className="text-sm text-foreground">{String(preview.summary_en ?? "—")}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{isEn ? "Requirements" : "রেকোয়ারমেন্টস"}</p>
                <pre className="max-h-[220px] overflow-auto rounded bg-muted/60 p-3 text-xs">{pretty(preview.requirements ?? [])}</pre>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{isEn ? "Responsibilities" : "রেসপনসিবিলিটিস"}</p>
                <pre className="max-h-[220px] overflow-auto rounded bg-muted/60 p-3 text-xs">{pretty(preview.responsibilities ?? [])}</pre>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{isEn ? "Source sections" : "সোর্স সেকশন"}</p>
              <pre className="max-h-[280px] overflow-auto rounded bg-muted/60 p-3 text-xs">{pretty(preview.source_sections ?? parserPayload.raw_sections ?? [])}</pre>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
