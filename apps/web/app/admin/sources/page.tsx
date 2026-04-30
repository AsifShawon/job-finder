import { Database, Plus } from "lucide-react";

import { AdminSourceManager } from "@/components/admin-source-manager";
import { fetchBackendJsonWithAuth } from "@/lib/server-auth-fetch";
import { getLocale } from "@/lib/i18n";
import type { AdminSource } from "@/lib/types";

export default async function AdminSourcesPage() {
  const [sources, locale] = await Promise.all([
    fetchBackendJsonWithAuth<AdminSource[]>("/api/v1/admin/sources"),
    getLocale(),
  ]);
  const data = sources ?? [];
  const isEn = locale === "en";

  return (
    <div className="space-y-6">
      <div role="region" aria-label={isEn ? "Source page header" : "সোর্স পেজের শিরোনাম"}>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {isEn ? "Source Registry" : "উৎস রেজিস্ট্রি"}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">
          {isEn ? "Manage Sources" : "উৎস পরিচালনা"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEn
            ? "Register, configure, and monitor crawl sources. Set trust tiers and crawl frequency."
            : "উৎস নিবন্ধন, কনফিগার ও পর্যবেক্ষণ করুন। বিশ্বাসযোগ্যতার স্তর ও ক্রল ফ্রিকোয়েন্সি নির্ধারণ করুন।"}
        </p>
      </div>

      {/* Stats */}
      <div
        className="flex flex-wrap items-center gap-3"
        role="region"
        aria-label={isEn ? "Source summary badges" : "সোর্স সারাংশ ব্যাজ"}
      >
        {[
          {
            label: isEn ? "Total" : "মোট",
            value: data.length,
          },
          {
            label: isEn ? "Enabled" : "সক্রিয়",
            value: data.filter((s) => s.enabled ?? s.is_active).length,
          },
          {
            label: isEn ? "Government" : "সরকারি",
            value: data.filter((s) => s.trust_level === "government_official").length,
          },
          {
            label: isEn ? "Pending review" : "পর্যালোচনা বাকি",
            value: data.reduce((n, s) => n + (s.pending_review_count ?? 0), 0),
          },
        ].map(({ label, value }) => (
          <span
            key={label}
            className="rounded-full border border-border bg-card px-3 py-1 text-sm font-semibold"
          >
            {value} {label}
          </span>
        ))}
      </div>

      <AdminSourceManager initialSources={data} />
    </div>
  );
}
