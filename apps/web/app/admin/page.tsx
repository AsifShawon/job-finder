import type { Route } from "next";
import Link from "next/link";
import {
  Database,
  Activity,
  Users,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  ExternalLink,
} from "lucide-react";

import { AdminAiSettingsForm } from "@/components/admin-ai-settings-form";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLocale } from "@/lib/i18n";
import { fetchBackendJsonWithAuth } from "@/lib/server-auth-fetch";
import type { AdminAiSettings, AdminOverview } from "@/lib/types";
import { formatDateTime, humanizeSlug } from "@/lib/utils";

function CrawlStatusBadge({ status }: { status: string }) {
  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-400">
        <CheckCircle className="h-3 w-3" /> সফল
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-900/20 dark:text-red-400">
        <XCircle className="h-3 w-3" /> ব্যর্থ
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
        <Loader2 className="h-3 w-3 animate-spin" /> চলমান
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
      {humanizeSlug(status, "bn")}
    </span>
  );
}

export default async function AdminPage() {
  const locale = await getLocale();
  const isEn = locale === "en";

  const [overview, aiSettings] = await Promise.all([
    fetchBackendJsonWithAuth<AdminOverview>("/api/v1/admin/overview"),
    fetchBackendJsonWithAuth<AdminAiSettings>("/api/v1/admin/settings/ai"),
  ]);

  const settings = aiSettings ?? {
    ai_provider: "groq",
    ai_api_key_configured: false,
    ai_model: "llama-3.3-70b-versatile",
  };

  if (!overview) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">
          {isEn ? "Could not load admin overview." : "অ্যাডমিন ওভারভিউ লোড হয়নি।"}
        </p>
      </Card>
    );
  }

  const s = overview.stats;

  const STAT_CARDS = [
    {
      icon: Database,
      label: isEn ? "Sources" : "উৎস",
      value: s.total_sources,
      sub: isEn ? `${s.active_sources} active` : `${s.active_sources}টি সক্রিয়`,
      href: "/admin/sources" as Route,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      icon: CheckCircle,
      label: isEn ? "Opportunities" : "সুযোগ",
      value: s.total_opportunities,
      sub: isEn ? `${s.active_opportunities} active` : `${s.active_opportunities}টি সক্রিয়`,
      href: "/search" as Route,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-900/20",
    },
    {
      icon: Users,
      label: isEn ? "Users" : "ব্যবহারকারী",
      value: s.total_users,
      sub: isEn ? `${s.total_alert_rules} alert rules` : `${s.total_alert_rules}টি সতর্কতা নিয়ম`,
      href: "/admin" as Route,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      icon: Activity,
      label: isEn ? "Crawls (running)" : "ক্রল (চলমান)",
      value: s.running_crawls,
      sub: isEn
        ? `${s.failed_crawls_last_24h} failures in 24h`
        : `২৪ঘন্টায় ${s.failed_crawls_last_24h}টি ব্যর্থ`,
      href: "/admin/crawls" as Route,
      color: s.failed_crawls_last_24h > 0 ? "text-red-600" : "text-amber-600",
      bg: s.failed_crawls_last_24h > 0
        ? "bg-red-50 dark:bg-red-900/20"
        : "bg-amber-50 dark:bg-amber-900/20",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {isEn ? "Overview" : "ওভারভিউ"}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">
          {isEn ? "Admin Dashboard" : "অ্যাডমিন ড্যাশবোর্ড"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEn
            ? "Monitor ingestion health, source coverage, and review queue."
            : "ইনজেশন স্বাস্থ্য, উৎস কভারেজ এবং রিভিউ কিউ পর্যবেক্ষণ করুন।"}
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {STAT_CARDS.map(({ icon: Icon, label, value, sub, href, color, bg }) => (
          <Link
            key={label}
            href={href}
            className="group rounded-lg border border-border bg-card p-4 shadow-card hover:border-primary hover:shadow-card-hover transition-all"
          >
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">{label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
          </Link>
        ))}
      </div>

      {/* Alert if review queue has items */}
      {s.queued_alert_events > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
          <p className="text-sm text-foreground">
            {isEn
              ? `${s.queued_alert_events} alert events queued for delivery.`
              : `${s.queued_alert_events}টি সতর্কতা ইভেন্ট পাঠানোর জন্য অপেক্ষমাণ।`}
          </p>
          <Link href="/admin/review" className="ml-auto text-sm font-semibold text-primary hover:underline">
            {isEn ? "Review →" : "পর্যালোচনা →"}
          </Link>
        </div>
      )}

      {/* Bottom grid */}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        {/* Recent crawls */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-foreground section-underline">
              {isEn ? "Recent Crawls" : "সাম্প্রতিক ক্রল"}
            </h2>
            <Link href="/admin/crawls" className="text-xs font-semibold text-primary hover:underline">
              {isEn ? "View all →" : "সব দেখুন →"}
            </Link>
          </div>
          <div className="space-y-3">
            {overview.recent_crawls.map((crawl) => (
              <div
                key={crawl.id}
                className="rounded-md border border-border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {crawl.source_name ?? `${isEn ? "Source" : "উৎস"} #${crawl.source_id}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Job #{crawl.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CrawlStatusBadge status={crawl.status} />
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(crawl.started_at, locale)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{isEn ? "Pages" : "পেজ"}: {crawl.pages_fetched}</span>
                  <span>{isEn ? "Extracted" : "এক্সট্র্যাক্টেড"}: {crawl.records_extracted}</span>
                  {crawl.error_message && (
                    <span className="text-red-500 truncate max-w-[200px]">
                      ⚠ {crawl.error_message}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Right column */}
        <div className="space-y-5">
          {/* AI Settings */}
          <Card>
            <h2 className="mb-4 font-bold text-foreground section-underline">
              {isEn ? "AI Settings" : "AI সেটিংস"}
            </h2>
            <AdminAiSettingsForm initialSettings={settings} />
          </Card>

          {/* Source coverage mini-list */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-foreground section-underline">
                {isEn ? "Sources" : "উৎস কভারেজ"}
              </h2>
              <Link href="/admin/sources" className="text-xs font-semibold text-primary hover:underline">
                {isEn ? "Manage →" : "পরিচালনা →"}
              </Link>
            </div>
            <div className="space-y-2">
              {overview.sources.slice(0, 5).map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{source.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {source.opportunity_count} {isEn ? "opps" : "সুযোগ"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-semibold ${
                      source.is_active ? "text-success" : "text-muted-foreground"
                    }`}
                  >
                    {source.is_active
                      ? (isEn ? "Active" : "সক্রিয়")
                      : (isEn ? "Paused" : "স্থগিত")}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
