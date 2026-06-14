"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { useLocale } from "next-intl";
import {
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  Coins,
  ShieldCheck,
} from "lucide-react";

import { MiniVoiceButton } from "@/components/mini-voice-button";
import type { CopilotChatCitation } from "@/lib/types";
import { pickLang } from "@/lib/i18n-shared";
import { cn, formatDate } from "@/lib/utils";
import { formatVoiceDate, getVoiceField, joinVoiceParts } from "@/lib/voice-script";

type Locale = "bn" | "en";

const TEXT = {
  bn: {
    details: "বিস্তারিত",
    listen: "শুনুন",
    deadlineLabel: "শেষ তারিখ",
    deadlineMissing: "শেষ তারিখ নেই",
    save: "সংরক্ষণ করুন",
    removeSave: "সংরক্ষণ বাতিল",
    suitableForBd: "বাংলাদেশ থেকে আবেদন",
    salaryLabel: "বেতন",
    salaryMissing: "বেতন উল্লেখ নেই",
  },
  en: {
    details: "Details",
    listen: "Listen",
    deadlineLabel: "Deadline",
    deadlineMissing: "No deadline",
    save: "Save",
    removeSave: "Unsave",
    suitableForBd: "Apply from BD",
    salaryLabel: "Salary",
    salaryMissing: "Salary not specified",
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

function daysUntil(deadline: string | null | undefined) {
  if (!deadline) return null;
  const parts = deadline.split("-").map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return null;
  const targetUtc = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.ceil((targetUtc - todayUtc) / 86400000);
}

function cardVoiceText(item: CopilotChatCitation, locale: Locale, title: string) {
  if (locale !== "bn") {
    return `${title}`.trim();
  }
  const titleVoice = getVoiceField(item, "title", "bn");
  const locationVoice = joinVoiceParts([
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

export function CopilotOpportunityMiniCard({
  item,
  onSavedChange,
}: {
  item: CopilotChatCitation;
  onSavedChange?: (saved: boolean) => void;
}) {
  const locale = useLocale() as Locale;
  const [saved, setSaved] = useState(item.is_saved);
  const [saving, setSaving] = useState(false);

  const title = pickLang(item, "title", locale) || item.title || "Untitled";
  const detailUrl = `/opportunity/${item.opportunity_id}` as Route;
  const country = item.destination_country || item.country || "";
  const countryCode = countryToCode(country);
  const spokenText = cardVoiceText(item, locale, title);

  const salary = pickLang(item, "salary_text", locale) || 
                 item.salary_text || 
                 (item.salary_min ? `${item.salary_min}${item.salary_max ? ` - ${item.salary_max}` : ""} ${item.salary_currency || ""}` : null);

  const toggleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/saved/${item.opportunity_id}`, {
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
    <article className="relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md max-w-full">
      <div className="space-y-2">
        {/* Top Badges & Flags & Actions */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex flex-wrap gap-1 items-center">
            {country ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                {countryCode && (
                  <img
                    src={`https://flagcdn.com/w20/${countryCode.toLowerCase()}.png`}
                    width={12}
                    height={8}
                    alt=""
                    className="rounded-[1px] object-cover shrink-0"
                  />
                )}
                <span className="truncate max-w-[80px]">{country}</span>
              </span>
            ) : null}

            {item.source_trust_badge && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700 border border-teal-100">
                <ShieldCheck className="h-3 w-3 shrink-0 text-teal-600" />
                <span className="truncate max-w-[80px]">{item.source_trust_badge}</span>
              </span>
            )}

            {item.can_apply_from_bd && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100">
                {TEXT[locale].suitableForBd}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <MiniVoiceButton
              text={spokenText}
              locale={locale}
              size="sm"
              ariaLabel={TEXT[locale].listen}
              className="h-8 w-8 border-slate-150 hover:bg-slate-50 shrink-0"
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
                  ? "border-teal-200 bg-teal-50/50 text-teal-700"
                  : "border-slate-150 text-slate-400 hover:border-teal-500 hover:text-teal-600"
              )}
            >
              {saved ? (
                <BookmarkCheck className="h-4 w-4 fill-current text-teal-600" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Title */}
        <h4 className="text-sm font-bold leading-snug text-slate-900 line-clamp-2">
          <Link href={detailUrl} className="hover:text-teal-600 transition-colors">
            {title}
          </Link>
        </h4>

        {/* Deadline & Salary Info */}
        <div className="flex flex-col gap-1 text-[11px] font-semibold">
          <p className={cn(
            "inline-flex items-center gap-1",
            isUrgent ? "text-rose-600 font-bold" : "text-slate-500"
          )}>
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            <span>
              {TEXT[locale].deadlineLabel}: {item.deadline ? formatDate(item.deadline, locale) : TEXT[locale].deadlineMissing}
            </span>
          </p>

          <p className="inline-flex items-center gap-1 text-slate-500">
            <Coins className="h-3.5 w-3.5 shrink-0" />
            <span>
              {TEXT[locale].salaryLabel}: {salary || TEXT[locale].salaryMissing}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-2.5 pt-2 border-t border-slate-100">
        <Link
          href={detailUrl}
          className="inline-flex min-h-[36px] w-full items-center justify-center rounded-lg bg-teal-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
        >
          {TEXT[locale].details}
        </Link>
      </div>
    </article>
  );
}
