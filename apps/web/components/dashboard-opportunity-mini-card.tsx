"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { useLocale } from "next-intl";
import {
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  Sparkles,
} from "lucide-react";

import { MiniVoiceButton } from "@/components/mini-voice-button";
import type {
  OpportunityCard as OpportunityCardType,
  PublishedOpportunityDetail,
  RecommendationCard,
} from "@/lib/types";
import { pickLang } from "@/lib/i18n-shared";
import { getISCSectorByKey, ISC_SECTORS } from "@/lib/isc-sectors";
import { cn, formatDate } from "@/lib/utils";
import { formatVoiceDate, getVoiceField, joinVoiceParts } from "@/lib/voice-script";

type AnyCard = OpportunityCardType | RecommendationCard;
type RichCardItem = AnyCard &
  Partial<
    Pick<
      PublishedOpportunityDetail,
      | "application_url"
      | "city"
      | "experience_min_years"
      | "location_text"
      | "location_text_bn"
      | "location_text_en"
      | "skill_level"
    >
  >;

type Locale = "bn" | "en";

const TEXT = {
  bn: {
    details: "বিস্তারিত দেখুন",
    listen: "শুনুন",
    deadlineLabel: "শেষ তারিখ",
    deadlineMissing: "শেষ তারিখ উল্লেখ নেই",
    save: "সংরক্ষণ করুন",
    removeSave: "সংরক্ষণ বাতিল করুন",
    matchPrefix: "কেন মিল",
    matchFallback: "আপনার প্রোফাইলের সঙ্গে মিল আছে।",
    suitableForBd: "বাংলাদেশ থেকে আবেদন",
  },
  en: {
    details: "Details",
    listen: "Listen",
    deadlineLabel: "Deadline",
    deadlineMissing: "No deadline",
    save: "Save",
    removeSave: "Unsave",
    matchPrefix: "Why matched",
    matchFallback: "Matches your profile.",
    suitableForBd: "Apply from BD",
  },
} as const;

const COUNTRY_CODE_MAP: Record<string, string> = {
  "saudi arabia": "SA",
  saudi: "SA",
  ksa: "SA",
  qatar: "QA",
  oman: "OM",
  bahrain: "BH",
  kuwait: "KW",
  "united arab emirates": "AE",
  uae: "AE",
  dubai: "AE",
  malaysia: "MY",
  singapore: "SG",
  japan: "JP",
  "south korea": "KR",
  korea: "KR",
  italy: "IT",
  germany: "DE",
  canada: "CA",
  usa: "US",
  "united kingdom": "GB",
  uk: "GB",
};

function normalizeKey(value: string) {
  return value.toLowerCase().trim().replace(/[().,]/g, "").replace(/\s+/g, " ");
}

function countryToCode(country: string | null | undefined): string | null {
  if (!country) return null;
  const trimmed = country.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return COUNTRY_CODE_MAP[normalizeKey(trimmed)] ?? null;
}

function parseDateOnlyUtc(dateString: string) {
  const [year, month, day] = dateString.split("-").map((value) => Number(value));
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day);
}

function daysUntil(deadline: string | null | undefined) {
  if (!deadline) return null;
  const targetUtc = parseDateOnlyUtc(deadline);
  if (targetUtc == null) return null;
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.ceil((targetUtc - todayUtc) / 86400000);
}

function titleText(item: RichCardItem, locale: Locale) {
  return pickLang(item, "title", locale) ?? item.title;
}

function countryText(item: RichCardItem, locale: Locale) {
  const fallback = [item.city, item.destination_country, item.country]
    .filter((v): v is string => Boolean(v && v.trim()))
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(", ");
  return item.destination_country ?? item.country ?? pickLang(item, "location_text", locale) ?? (fallback || null);
}

function matchReason(item: AnyCard, locale: Locale) {
  const explicit = item.why_this_matches?.trim();
  if (explicit) return explicit;
  const iscMatchKey = "isc_match_key" in item ? item.isc_match_key : null;
  if (iscMatchKey) {
    const sector = ISC_SECTORS.find((entry) => entry.key === iscMatchKey);
    if (sector) {
      return locale === "en"
        ? `Selected ${sector.en}.`
        : `আপনার বিষয় ${sector.bn}।`;
    }
  }
  if (item.can_apply_from_bd) {
    return locale === "en"
      ? "Apply directly from Bangladesh."
      : "বাংলাদেশ থেকে সরাসরি আবেদনযোগ্য।";
  }
  return TEXT[locale].matchFallback;
}

function cardVoiceText(item: RichCardItem, locale: Locale, title: string) {
  if (locale !== "bn") {
    return `${title}`.trim();
  }
  const titleVoice = getVoiceField(item, "title", "bn");
  const locationVoice = joinVoiceParts([
    getVoiceField(item, "location_text", "bn"),
    getVoiceField(item, "destination_country", "bn") ?? getVoiceField(item, "country", "bn"),
  ], "bn");
  const deadlineVoice = formatVoiceDate(item.deadline, "bn");
  return (
    joinVoiceParts(
      [
        titleVoice,
        locationVoice ? `লোকেশন, ${locationVoice}` : null,
        deadlineVoice ? `শেষ তারিখ, ${deadlineVoice}` : null,
      ],
      "bn",
    ) ?? ""
  );
}

export function DashboardOpportunityMiniCard({
  item,
  onSavedChange,
  highlighted = false,
}: {
  item: RichCardItem;
  onSavedChange?: (saved: boolean) => void;
  highlighted?: boolean;
}) {
  const locale = useLocale() as Locale;
  const [saved, setSaved] = useState(item.is_saved);
  const [saving, setSaving] = useState(false);

  const title = titleText(item, locale);
  const detailUrl = `/opportunity/${item.id}` as Route;
  const country = countryText(item, locale);
  const countryCode = countryToCode(country);
  const matchText = matchReason(item, locale);
  const spokenText = cardVoiceText(item, locale, title);

  const toggleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/saved/${item.id}`, {
        method: saved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) return;
      setSaved((current) => {
        const next = !current;
        onSavedChange?.(next);
        return next;
      });
    } finally {
      setSaving(false);
    }
  };

  const isUrgent = item.deadline && (daysUntil(item.deadline) ?? 99) <= 7;

  return (
    <article
      className={cn(
        "relative flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-sm transition-all hover:shadow-md dark:bg-slate-900/40",
        highlighted
          ? "border-primary/30 ring-1 ring-primary/10 dark:border-primary/40"
          : "border-slate-150 dark:border-slate-800"
      )}
    >
      {highlighted && (
        <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm uppercase tracking-wider">
          {locale === "en" ? "Best Match" : "সেরা মিল"}
        </span>
      )}

      <div className="space-y-2.5">
        {/* Top Badges & Flags */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5 items-center">
            {country ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-350">
                {countryCode && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://flagcdn.com/w20/${countryCode.toLowerCase()}.png`}
                    width={14}
                    height={10}
                    alt=""
                    className="rounded-[1px] object-cover shrink-0"
                  />
                )}
                <span className="truncate max-w-[80px] sm:max-w-[120px]">{country}</span>
              </span>
            ) : null}
            {item.can_apply_from_bd && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                {TEXT[locale].suitableForBd}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <MiniVoiceButton
              text={spokenText}
              locale={locale}
              size="sm"
              ariaLabel={TEXT[locale].listen}
              className="h-8 w-8 border-slate-100 hover:bg-slate-50 shrink-0"
              disabled={!spokenText}
            />
            <button
              type="button"
              onClick={toggleSave}
              disabled={saving}
              aria-label={saved ? TEXT[locale].removeSave : TEXT[locale].save}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors shrink-0",
                saved
                  ? "border-primary/20 bg-primary/5 text-primary"
                  : "border-slate-100 text-slate-400 hover:border-primary hover:text-primary dark:border-slate-800"
              )}
            >
              {saved ? (
                <BookmarkCheck className="h-4 w-4 fill-current" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Title */}
        <h4 className="text-sm sm:text-base font-bold leading-snug text-slate-900 dark:text-slate-50 line-clamp-2">
          <Link href={detailUrl} className="hover:text-primary transition-colors">
            {title}
          </Link>
        </h4>

        {/* Highlight details / why matches */}
        <div className="flex flex-col gap-1.5 pt-0.5">
          <p className="inline-flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-medium">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-0.5" />
            <span className="line-clamp-2">{matchText}</span>
          </p>

          {item.deadline && (
            <p className={cn(
              "inline-flex items-center gap-1.5 text-xs font-semibold",
              isUrgent ? "text-rose-600" : "text-slate-450"
            )}>
              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
              <span>
                {TEXT[locale].deadlineLabel}: {formatDate(item.deadline, locale)}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-850">
        <Link
          href={detailUrl}
          className="inline-flex min-h-[38px] w-full items-center justify-center rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          {TEXT[locale].details}
        </Link>
      </div>
    </article>
  );
}
