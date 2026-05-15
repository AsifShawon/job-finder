import { AlertCircle } from "lucide-react";

import { AdminReviewTable } from "@/components/admin-review-table";
import { fetchBackendJsonWithAuth } from "@/lib/server-auth-fetch";
import { getLocale } from "@/lib/i18n";
import type { DraftItem, ReviewQueuePage } from "@/lib/types";

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toBooleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function toNumberRecordOrNull(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, number] =>
      typeof entry[0] === "string" &&
      typeof entry[1] === "number" &&
      Number.isFinite(entry[1]),
  );

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function normalizeDraftItem(value: unknown): DraftItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<Record<keyof DraftItem, unknown>>;

  const id = toNumber(item.id, Number.NaN);
  const title = toStringOrNull(item.title);
  if (!Number.isFinite(id) || !title) return null;

  return {
    id,
    title,
    title_bn: toStringOrNull(item.title_bn),
    opportunity_type: toStringOrNull(item.opportunity_type) as DraftItem["opportunity_type"],
    source_id: toNumber(item.source_id),
    source_name: toStringOrNull(item.source_name),
    source_page_url: toStringOrEmpty(item.source_page_url),
    document_url: toStringOrNull(item.document_url),
    original_apply_url: toStringOrNull(item.original_apply_url),
    content_type: toStringOrNull(item.content_type) as DraftItem["content_type"],
    country: toStringOrNull(item.country),
    destination_country: toStringOrNull(item.destination_country),
    employer_or_organization: toStringOrNull(item.employer_or_organization),
    deadline: toStringOrNull(item.deadline),
    salary_text: toStringOrNull(item.salary_text),
    eligibility_status: toStringOrNull(item.eligibility_status) as DraftItem["eligibility_status"],
    can_apply_from_bd: toBooleanOrNull(item.can_apply_from_bd),
    requires_existing_work_permit: toBooleanOrNull(item.requires_existing_work_permit),
    open_to_international_candidates: toBooleanOrNull(item.open_to_international_candidates),
    lmia_status: toStringOrNull(item.lmia_status) as DraftItem["lmia_status"],
    summary_bn: toStringOrNull(item.summary_bn),
    summary_en: toStringOrNull(item.summary_en),
    extraction_confidence: toNumber(item.extraction_confidence),
    needs_admin_review: typeof item.needs_admin_review === "boolean" ? item.needs_admin_review : true,
    review_status: toStringOrNull(item.review_status) as DraftItem["review_status"],
    reviewed_by: typeof item.reviewed_by === "number" ? item.reviewed_by : null,
    reviewed_at: toStringOrNull(item.reviewed_at),
    target_audience_tags: toStringArray(item.target_audience_tags),
    risk_flags: toStringArray(item.risk_flags),
    source_trust_badge: toStringOrNull(item.source_trust_badge),
    connector_key: toStringOrNull(item.connector_key),
    admin_status: toStringOrNull(item.admin_status),
    platform_category_bn: toStringOrNull(item.platform_category_bn),
    platform_category_en: toStringOrNull(item.platform_category_en),
    bangladesh_applicability: toStringOrNull(item.bangladesh_applicability),
    bangladesh_applicability_reason: toStringOrNull(item.bangladesh_applicability_reason),
    rural_user_fit_score: toNumber(item.rural_user_fit_score),
    actionability_score: toNumber(item.actionability_score),
    trust_score: toNumber(item.trust_score),
    overall_rank_score: toNumber(item.overall_rank_score),
    extraction_warnings: toStringArray(item.extraction_warnings),
    raw_text: toStringOrNull(item.raw_text),
    created_at: toStringOrEmpty(item.created_at),
    field_confidences: toNumberRecordOrNull(item.field_confidences),
    record_type: toStringOrNull(item.record_type) as DraftItem["record_type"],
    source_url: toStringOrNull(item.source_url),
  };
}

function normalizeReviewQueuePayload(payload: unknown): {
  items: DraftItem[];
  total: number;
  malformed: boolean;
} {
  if (!payload || typeof payload !== "object") {
    return { items: [], total: 0, malformed: false };
  }

  const data = payload as { items?: unknown; total?: unknown };
  const rawItems = data.items;
  const items = Array.isArray(rawItems) ? rawItems.map(normalizeDraftItem).filter((item): item is DraftItem => item !== null) : [];
  const malformed =
    rawItems !== undefined &&
    (!Array.isArray(rawItems) || items.length !== rawItems.length);
  const total = typeof data.total === "number" ? data.total : items.length;

  return { items, total, malformed };
}

export default async function AdminReviewPage() {
  const [data, locale] = await Promise.all([
    fetchBackendJsonWithAuth<ReviewQueuePage>("/api/v1/admin/review-queue"),
    getLocale(),
  ]);
  const isEn = locale === "en";
  const { items, total, malformed } = normalizeReviewQueuePayload(data);

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

      {malformed && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-300/40 bg-rose-50/60 px-4 py-3 dark:border-rose-700/30 dark:bg-rose-900/10">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <p className="text-sm text-foreground">
            {isEn
              ? "Some review items could not be loaded because the server returned malformed data."
              : "সার্ভার ত্রুটিপূর্ণ ডেটা ফেরত দেওয়ায় কিছু রিভিউ আইটেম লোড করা যায়নি।"}
          </p>
        </div>
      )}

      <AdminReviewTable items={items} isEn={isEn} />
    </div>
  );
}
