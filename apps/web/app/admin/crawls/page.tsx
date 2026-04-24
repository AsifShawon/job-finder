import { Card } from "@/components/ui/card";
import { fetchBackendJsonWithAuth } from "@/lib/server-auth-fetch";
import type { CrawlJobPage } from "@/lib/types";
import { formatDateTime, humanizeSlug } from "@/lib/utils";

export default async function AdminCrawlsPage() {
  const data =
    (await fetchBackendJsonWithAuth<CrawlJobPage>("/api/v1/admin/crawl-jobs")) ??
    { items: [], total: 0, page: 1, page_size: 20 };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Pipeline monitoring</p>
        <h1 className="font-display text-3xl font-bold">Crawl jobs</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Inspect recent crawl runs, extracted record counts, runtime failures, and source-specific throughput.
        </p>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="py-2">ID</th>
                <th>Source</th>
                <th>Status</th>
                <th>Started</th>
                <th>Finished</th>
                <th>Pages</th>
                <th>Extracted</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr><td className="py-3" colSpan={8}>No crawl records or unauthorized.</td></tr>
              ) : (
                data.items.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2">{c.id}</td>
                    <td>{c.source_name ?? `Source #${c.source_id}`}</td>
                    <td>{humanizeSlug(c.status)}</td>
                    <td>{formatDateTime(c.started_at)}</td>
                    <td>{formatDateTime(c.finished_at)}</td>
                    <td>{c.pages_fetched}</td>
                    <td>{c.records_extracted}</td>
                    <td>{c.error_message ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
