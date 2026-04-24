import { AdminAiSettingsForm } from "@/components/admin-ai-settings-form";
import { Card } from "@/components/ui/card";
import { fetchBackendJsonWithAuth } from "@/lib/server-auth-fetch";
import type { AdminAiSettings, AdminOverview } from "@/lib/types";
import { formatDateTime, humanizeSlug } from "@/lib/utils";

export default async function AdminPage() {
  const overview = await fetchBackendJsonWithAuth<AdminOverview>("/api/v1/admin/overview");
  const aiSettings =
    (await fetchBackendJsonWithAuth<AdminAiSettings>("/api/v1/admin/settings/ai")) ??
    { groq_api_key_configured: false, groq_model: "llama-3.3-70b-versatile" };

  if (!overview) {
    return (
      <Card>
        <p className="text-sm text-slate-600 dark:text-slate-300">Could not load admin overview.</p>
      </Card>
    );
  }

  const statCards = [
    ["Sources", String(overview.stats.total_sources), `${overview.stats.active_sources} active`],
    ["Opportunities", String(overview.stats.total_opportunities), `${overview.stats.active_opportunities} active`],
    ["Users", String(overview.stats.total_users), `${overview.stats.total_alert_rules} alert rules`],
    ["Crawls", String(overview.stats.running_crawls), `${overview.stats.failed_crawls_last_24h} failures in 24h`],
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Overview</p>
        <h1 className="font-display text-4xl font-bold">Admin dashboard</h1>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Monitor ingestion health, source coverage, queued operational work, and recent crawl results in one place.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map(([label, value, hint]) => (
          <Card key={label} className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
            <p className="font-display text-3xl font-bold">{value}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">{hint}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">Recent crawls</h2>
            <p className="text-sm text-slate-500">{overview.recent_crawls.length} recent jobs</p>
          </div>
          <div className="space-y-3">
            {overview.recent_crawls.map((crawl) => (
              <div key={crawl.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{crawl.source_name ?? `Source #${crawl.source_id}`}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Job #{crawl.id} | {humanizeSlug(crawl.status)}
                    </p>
                  </div>
                  <p className="text-sm text-slate-500">{formatDateTime(crawl.started_at)}</p>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-3">
                  <p>Pages fetched: {crawl.pages_fetched}</p>
                  <p>Extracted: {crawl.records_extracted}</p>
                  <p>Error: {crawl.error_message ?? "None"}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4">
            <div>
              <h2 className="font-display text-2xl font-bold">AI settings</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Configure Groq for Copilot answers and structured extraction.
              </p>
            </div>
            <AdminAiSettingsForm initialSettings={aiSettings} />
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">Source coverage</h2>
              <p className="text-sm text-slate-500">{overview.sources.length} listed</p>
            </div>
            <div className="space-y-3">
              {overview.sources.map((source) => (
                <div key={source.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{source.name}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{humanizeSlug(source.trust_tier)}</p>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {source.is_active ? "Active" : "Paused"}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <p>Opportunities: {source.opportunity_count}</p>
                    <p>Raw docs: {source.raw_document_count}</p>
                    <p>Last crawl: {source.last_crawl_status ? humanizeSlug(source.last_crawl_status) : "Never ran"}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
