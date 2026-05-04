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
  ShieldCheck,
} from "lucide-react";

import type {
  OpportunityCard as OpportunityCardType,
  RecommendationCard,
} from "@/lib/types";
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

function daysUntil(deadline: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(`${deadline}T00:00:00Z`);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function getDeadlineTone(days: number | null) {
  if (days == null) {
    return "text-muted-foreground";
  }

  if (days <= 7) {
    return "text-red-600 dark:text-red-400";
  }

  if (days <= 30) {
    return "text-amber-600 dark:text-amber-400";
  }

  return "text-emerald-600 dark:text-emerald-400";
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
    return locale === "en" ? "Official" : "সরকারি ✓";
  }

  return badge;
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

  return (
    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
      {item.deadline && (
        <span className={cn("inline-flex items-center gap-1 font-semibold", getDeadlineTone(days))}>
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(item.deadline, locale)}
        </span>
      )}
      {(item.destination_country || item.country) && (
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {[item.destination_country, item.country].filter(Boolean).join(", ")}
        </span>
      )}
      {(item.salary_min != null || item.salary_text) && (
        <span className="inline-flex items-center gap-1">
          <Banknote className="h-3.5 w-3.5" />
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
}: {
  item: AnyCard;
  onSavedChange?: (saved: boolean) => void;
  variant?: "default" | "compact";
}) {
  const locale = useLocale() as "bn" | "en";
  const isEn = locale === "en";
  const [saved, setSaved] = useState(item.is_saved);
  const [saving, setSaving] = useState(false);

  const deadlineDays = item.deadline ? daysUntil(item.deadline) : null;
  const trust = trustLabel(item.source_trust_badge, locale);
  const summary = locale === "en" ? item.summary ?? item.summary_bn : item.summary_bn ?? item.summary;
  const applyHref = item.original_apply_url ?? item.source_url;

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
    return (
      <Link
        href={`/opportunity/${item.id}`}
        className="rounded-2xl border border-border bg-card p-4 shadow-card transition-all hover:border-primary hover:shadow-card-hover"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-primary">
              {typeLabel(item.opportunity_type, locale)}
            </span>
            <p className="mt-1 line-clamp-2 text-base font-semibold text-foreground">
              {locale === "en" ? item.title : item.title_bn || item.title}
            </p>
          </div>
          {item.deadline && (
            <span className={cn("text-xs font-semibold", getDeadlineTone(deadlineDays))}>
              {formatDate(item.deadline, locale)}
            </span>
          )}
        </div>
      </Link>
    );
  }

  return (
    <article className="rounded-2xl border border-border bg-card shadow-card transition-all hover:border-primary/40 hover:shadow-card-hover">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {typeLabel(item.opportunity_type, locale)}
            </span>
            {trust && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-700/30 dark:bg-emerald-900/20 dark:text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                {trust}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={toggleSave}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            aria-label={saved ? (isEn ? "Remove from saved" : "সংরক্ষণ বাতিল করুন") : (isEn ? "Save this opportunity" : "সুযোগটি সংরক্ষণ করুন")}
          >
            {saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
            <span>{saved ? (isEn ? "Saved" : "সংরক্ষিত") : (isEn ? "Save" : "সংরক্ষণ")}</span>
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <Link
            href={`/opportunity/${item.id}`}
            className="line-clamp-2 text-base font-semibold text-foreground transition-colors hover:text-primary sm:text-lg"
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

        {item.can_apply_from_bd && (
          <div className="mt-4">
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 dark:border-emerald-700/30 dark:bg-emerald-900/20 dark:text-emerald-400">
              {isEn ? "Eligible to apply from Bangladesh" : "বাংলাদেশ থেকে আবেদনযোগ্য"}
            </span>
          </div>
        )}

        {summary && (
          <p className="mt-4 line-clamp-2 text-muted-foreground">
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

      <div className="border-t border-border px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 sm:w-auto"
          >
            <span>{isEn ? "Apply Now" : "আবেদন করুন"}</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </article>
  );
}
