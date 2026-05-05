"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale } from "next-intl";
import {
  Banknote,
  Bookmark,
  BookmarkCheck,
  Calendar,
  ExternalLink,
  MapPin,
} from "lucide-react";

import type {
  OpportunityCard as OpportunityCardType,
  RecommendationCard,
} from "@/lib/types";
import { ISC_SECTORS } from "@/lib/isc-sectors";
import { cn, formatDate } from "@/lib/utils";

type AnyCard = OpportunityCardType | RecommendationCard;

const TYPE_LABELS = {
  overseas_job: { bn: "প্রবাস চাকরি", en: "Overseas Job" },
  local_job: { bn: "স্থানীয় চাকরি", en: "Local Job" },
  scholarship: { bn: "স্কলারশিপ", en: "Scholarship" },
  training: { bn: "প্রশিক্ষণ", en: "Training" },
  migration_policy: { bn: "ভিসা নীতি", en: "Visa Policy" },
  visa_update: { bn: "ভিসা আপডেট", en: "Visa Update" },
  circular: { bn: "সার্কুলার", en: "Circular" },
  warning: { bn: "সতর্কতা", en: "Warning" },
  news: { bn: "সংবাদ", en: "News" },
} as const;

const TYPE_ACCENTS: Record<string, string> = {
  overseas_job: "bg-emerald-500",
  scholarship: "bg-blue-500",
  migration_policy: "bg-amber-500",
  default: "bg-slate-300 dark:bg-slate-700",
};

function parseDateOnlyUtc(dateString: string): number | null {
  const [year, month, day] = dateString.split("-").map((value) => Number(value));
  if (!year || !month || !day) {
    return null;
  }
  return Date.UTC(year, month - 1, day);
}

function daysUntil(deadline: string): number | null {
  const targetUtc = parseDateOnlyUtc(deadline);
  if (targetUtc == null) {
    return null;
  }

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.ceil((targetUtc - todayUtc) / 86400000);
}

function typeLabel(type: string | null | undefined, locale: "bn" | "en") {
  if (!type) {
    return locale === "en" ? "Opportunity" : "সুযোগ";
  }

  const label = TYPE_LABELS[type as keyof typeof TYPE_LABELS];
  return label ? label[locale] : type;
}

function trustLabel(badge: string | null | undefined, locale: "bn" | "en") {
  if (!badge) {
    return null;
  }

  if (badge.includes("সরকারি")) {
    return locale === "en" ? "Government source" : "সরকারি উৎস";
  }

  return badge;
}

function accentClass(type: string | null | undefined) {
  if (!type) {
    return TYPE_ACCENTS.default;
  }

  return TYPE_ACCENTS[type] ?? TYPE_ACCENTS.default;
}

function matchReason(item: AnyCard, locale: "bn" | "en") {
  const explicit = item.why_this_matches?.trim();
  if (explicit) {
    return explicit;
  }

  const iscMatchKey = "isc_match_key" in item ? item.isc_match_key : null;
  if (iscMatchKey) {
    const sector = ISC_SECTORS.find((entry) => entry.key === iscMatchKey);
    if (sector) {
      return locale === "en"
        ? `You chose ${sector.en}, so this matches.`
        : `আপনি ${sector.bn} বেছেছেন, এই চাকরিটি মিলেছে`;
    }
  }

  if (item.can_apply_from_bd) {
    return locale === "en"
      ? "You can apply directly from Bangladesh."
      : "বাংলাদেশ থেকে সরাসরি আবেদন করা যাবে";
  }

  return locale === "en"
    ? "Matches your profile."
    : "আপনার প্রোফাইলের সঙ্গে মিল আছে";
}

function buildDeadlineText(
  deadline: string | null,
  days: number | null,
  locale: "bn" | "en",
) {
  if (!deadline || days == null) {
    return null;
  }

  if (days < 0) {
    return {
      text: formatDate(deadline, locale),
      className: "text-base font-semibold text-muted-foreground",
    };
  }

  if (days <= 7) {
    return {
      text: locale === "en" ? `⚡ ${days} days left` : `⚡ মাত্র ${days} দিন বাকি`,
      className: "text-base font-bold text-red-600 dark:text-red-400",
    };
  }

  if (days <= 30) {
    return {
      text: locale === "en" ? `📅 Ends in ${days} days` : `📅 ${days} দিনের মধ্যে শেষ`,
      className: "text-base font-semibold text-amber-600 dark:text-amber-400",
    };
  }

  return {
    text: formatDate(deadline, locale),
    className: "text-base font-semibold text-emerald-600 dark:text-emerald-400",
  };
}

function buildDeadlinePill(
  deadline: string | null,
  days: number | null,
  locale: "bn" | "en",
) {
  if (!deadline || days == null) {
    return null;
  }

  if (days < 0) {
    return {
      text: formatDate(deadline, locale),
      className: "bg-muted text-foreground",
    };
  }

  if (days <= 7) {
    return {
      text: locale === "en" ? `⚡ ${days} days` : `⚡ ${days} দিন`,
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200",
    };
  }

  if (days <= 30) {
    return {
      text: locale === "en" ? `📅 ${days} days` : `📅 ${days} দিন`,
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200",
    };
  }

  return {
    text: formatDate(deadline, locale),
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200",
  };
}

function buildSalaryText(item: AnyCard, locale: "bn" | "en") {
  if (item.salary_text) {
    return item.salary_text;
  }

  if (item.salary_min == null) {
    return locale === "en" ? "Not specified" : "উল্লেখ নেই";
  }

  const max = item.salary_max ? ` - ${item.salary_max}` : "";
  return `${item.salary_min}${max} ${item.salary_currency ?? ""}`.trim();
}

function CompactMeta({
  item,
  locale,
}: {
  item: AnyCard;
  locale: "bn" | "en";
}) {
  const days = item.deadline ? daysUntil(item.deadline) : null;
  const deadlineInfo = buildDeadlineText(item.deadline ?? null, days, locale);

  return (
    <div className="mt-3 flex flex-wrap gap-3 text-base text-muted-foreground">
      {deadlineInfo && (
        <span className={cn("inline-flex items-center gap-2", deadlineInfo.className)}>
          <Calendar className="h-4 w-4" />
          {deadlineInfo.text}
        </span>
      )}
      {(item.destination_country || item.country) && (
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-4 w-4" />
          {[item.destination_country, item.country].filter(Boolean).join(", ")}
        </span>
      )}
      {(item.salary_min != null || item.salary_text) && (
        <span className="inline-flex items-center gap-1">
          <Banknote className="h-4 w-4" />
          {buildSalaryText(item, locale)}
        </span>
      )}
    </div>
  );
}

export function OpportunityCard({
  item,
  onSavedChange,
  variant = "default",
  showMatchBanner = false,
}: {
  item: AnyCard;
  onSavedChange?: (saved: boolean) => void;
  variant?: "default" | "compact";
  showMatchBanner?: boolean;
}) {
  const locale = useLocale() as "bn" | "en";
  const isEn = locale === "en";
  const [saved, setSaved] = useState(item.is_saved);
  const [saving, setSaving] = useState(false);

  const deadlineDays = item.deadline ? daysUntil(item.deadline) : null;
  const trust = trustLabel(item.source_trust_badge, locale);
  const summary = locale === "en" ? item.summary ?? item.summary_bn : item.summary_bn ?? item.summary;
  const applyHref = item.original_apply_url ?? item.source_url;
  const accent = accentClass(item.opportunity_type);
  const matchBannerText = showMatchBanner ? matchReason(item, locale) : null;
  const matchStripText = item.why_this_matches?.trim();
  const showMatchStrip = Boolean(matchStripText) && (!matchBannerText || matchStripText !== matchBannerText);

  const toggleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/saved/${item.id}`, {
        method: saved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        return;
      }

      setSaved((current) => {
        const next = !current;
        onSavedChange?.(next);
        return next;
      });
    } finally {
      setSaving(false);
    }
  };

  if (variant === "compact") {
    const compactDeadline = buildDeadlinePill(item.deadline ?? null, deadlineDays, locale);

    return (
      <Link
        href={`/opportunity/${item.id}`}
        className="block w-full relative overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-card transition-all hover:border-primary hover:shadow-card-hover"
      >
        <span aria-hidden="true" className={cn("absolute left-0 top-0 h-full w-1", accent)} />
        <div className="min-w-0 space-y-1.5 pl-3">
          <span className="text-xs font-semibold text-primary">
            {typeLabel(item.opportunity_type, locale)}
          </span>
          <p className="line-clamp-2 text-sm font-semibold text-foreground">
            {locale === "en" ? item.title : item.title_bn || item.title}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {compactDeadline && (
              <span className={cn("rounded-full px-2 py-1 font-semibold", compactDeadline.className)}>
                {compactDeadline.text}
              </span>
            )}
            {(item.destination_country || item.country) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {[item.destination_country, item.country].filter(Boolean).join(", ")}
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <article className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all hover:border-primary/40 hover:shadow-card-hover">
      <span aria-hidden="true" className={cn("absolute left-0 top-0 h-full w-1", accent)} />
      <div className="p-4 sm:p-5">
        {matchBannerText && (
          <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
            {matchBannerText}
          </div>
        )}

        {item.can_apply_from_bd && (
          <div className="mb-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
              ✅ {isEn ? "Apply from Bangladesh" : "বাংলাদেশ থেকে আবেদন করুন"}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {typeLabel(item.opportunity_type, locale)}
            </span>
          </div>

          {trust && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-700/30 dark:bg-emerald-900/20 dark:text-emerald-300">
              🛡️ {trust}
            </span>
          )}

          <button
            type="button"
            onClick={toggleSave}
            disabled={saving}
            className="touch-target inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50 md:py-1.5"
            aria-label={saved ? (isEn ? "Remove from saved" : "সংরক্ষণ বাতিল করুন") : (isEn ? "Save this opportunity" : "সুযোগটি সংরক্ষণ করুন")}
          >
            {saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
            <span className="hidden md:inline">{saved ? (isEn ? "Saved" : "সংরক্ষিত") : (isEn ? "Save" : "সংরক্ষণ")}</span>
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <Link
            href={`/opportunity/${item.id}`}
            className="line-clamp-2 text-lg font-semibold text-foreground transition-colors hover:text-primary sm:text-xl"
          >
            {locale === "en" ? item.title : item.title_bn || item.title}
          </Link>

          {(item.employer_or_organization || item.destination_country || item.country) && (
            <p className="text-muted-foreground">
              {[item.employer_or_organization, item.destination_country || item.country]
                .filter(Boolean)
                .join(" • ")}
            </p>
          )}
        </div>

        {summary && (
          <p className="mt-4 line-clamp-2 text-base text-muted-foreground">
            {summary}
          </p>
        )}

        {item.content_type === "linkout_only" && (
          <span className="mt-3 inline-flex text-xs font-medium text-amber-600 dark:text-amber-400">
            ⚠ সরাসরি লিংক — বিস্তারিত মূল সাইটে
          </span>
        )}

        <CompactMeta item={item} locale={locale} />
      </div>

      {showMatchStrip && (
        <div className="border-t border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200 sm:px-5">
          ✓ {matchStripText}
        </div>
      )}

      <div className="border-t border-border px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Link
            href={`/opportunity/${item.id}`}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {isEn ? "View details" : "বিস্তারিত"} →
          </Link>

          <a
            href={applyHref}
            target="_blank"
            rel="noopener noreferrer"
            className="touch-target inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 md:w-auto"
            aria-label={isEn ? "Apply now" : "আবেদন করুন"}
          >
            <span>{isEn ? "Apply Now" : "আবেদন করুন"}</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </article>
  );
}
