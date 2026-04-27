import { Bell, Plus } from "lucide-react";

import { AlertsClient } from "@/app/alerts/alerts-client";
import { getLocale } from "@/lib/i18n";
import { fetchBackendJsonWithAuth, requireCurrentUser } from "@/lib/server-auth-fetch";
import type { AlertRulePage } from "@/lib/types";

export default async function AlertsPage() {
  await requireCurrentUser();
  const locale = await getLocale();
  const isEn = locale === "en";
  const data =
    (await fetchBackendJsonWithAuth<AlertRulePage>("/api/v1/alerts")) ??
    { items: [], total: 0, page: 1, page_size: 20 };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10">
                <Bell className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {isEn ? "Automated Alerts" : "স্বয়ংক্রিয় সতর্কতা"}
                </p>
                <h1 className="text-xl font-bold text-foreground">
                  {isEn ? "Alert Rules" : "সতর্কতার নিয়ম"}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="rounded-full border border-border bg-card px-3 py-1 font-semibold">
                {data.total} {isEn ? "rules" : "নিয়ম"}
              </span>
            </div>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {isEn
              ? "Set up rules to automatically get notified when new opportunities match your criteria."
              : "আপনার পছন্দের মানদণ্ড অনুযায়ী নতুন সুযোগ পেলে স্বয়ংক্রিয়ভাবে সতর্কতা পেতে নিয়ম তৈরি করুন।"}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Info banner */}
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-border bg-card p-4">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-sm text-muted-foreground">
            {isEn
              ? "Alert rules run automatically when new content is crawled. You'll be notified when new opportunities match your saved searches."
              : "নতুন কনটেন্ট ক্রল হলে সতর্কতার নিয়মগুলো স্বয়ংক্রিয়ভাবে চলে। আপনার সংরক্ষিত অনুসন্ধানের সাথে নতুন সুযোগ মিললে আপনাকে জানানো হবে।"}
          </p>
        </div>

        <AlertsClient initialAlerts={data.items} />
      </div>
    </div>
  );
}
