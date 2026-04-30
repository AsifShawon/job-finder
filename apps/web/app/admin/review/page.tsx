import { AlertCircle, ClipboardCheck } from "lucide-react";

import { AdminReviewTable } from "@/components/admin-review-table";
import { fetchBackendJsonWithAuth } from "@/lib/server-auth-fetch";
import { getLocale } from "@/lib/i18n";
import type { ReviewQueuePage } from "@/lib/types";

export default async function AdminReviewPage() {
  const [data, locale] = await Promise.all([
    fetchBackendJsonWithAuth<ReviewQueuePage>("/api/v1/admin/review-queue"),
    getLocale(),
  ]);
  const isEn = locale === "en";
  const items = data?.items ?? [];
  const total = data?.total ?? items.length;

  return (
    <div className="space-y-6">
      <div role="region" aria-label={isEn ? "Review queue header" : "রিভিউ কিউ শিরোনাম"}>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {isEn ? "Content Moderation" : "কনটেন্ট পর্যালোচনা"}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">
          {isEn ? "Review Queue" : "পর্যালোচনা কিউ"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEn
            ? "Review OCR-extracted and BOESL circulars before publishing. Approve, flag for fix, or reject each item."
            : "প্রকাশের আগে OCR-নিষ্কাশিত ও BOESL সার্কুলার পর্যালোচনা করুন। অনুমোদন, সংশোধন বা প্রত্যাখ্যান করুন।"}
        </p>
      </div>

      {total > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300/40 bg-amber-50/60 px-4 py-3 dark:border-amber-700/30 dark:bg-amber-900/10">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm text-foreground">
            {isEn
              ? `${total} item${total === 1 ? "" : "s"} awaiting review.`
              : `${total}টি আইটেম পর্যালোচনার অপেক্ষায়।`}
          </p>
        </div>
      )}

      <AdminReviewTable items={items} isEn={isEn} />
    </div>
  );
}
