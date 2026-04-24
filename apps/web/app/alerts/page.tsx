import { AlertsClient } from "@/app/alerts/alerts-client";
import { fetchBackendJsonWithAuth, requireCurrentUser } from "@/lib/server-auth-fetch";
import type { AlertRulePage } from "@/lib/types";

export default async function AlertsPage() {
  await requireCurrentUser();
  const data =
    (await fetchBackendJsonWithAuth<AlertRulePage>("/api/v1/alerts")) ??
    { items: [], total: 0, page: 1, page_size: 20 };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Automation</p>
        <h1 className="font-display text-4xl font-bold">Alert rules</h1>
        <p className="max-w-3xl text-sm text-slate-700 dark:text-slate-300">
          Define the opportunity patterns you want monitored. Beat schedules the checks, and the worker generates matching alert events from fresh crawl results.
        </p>
      </div>
      <AlertsClient initialAlerts={data.items} />
    </div>
  );
}
