"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { useLocale } from "next-intl";
import {
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  CalendarClock,
  CircleAlert,
  MapPin,
  ShieldCheck,
  Sparkles,
  Tag,
  UserRoundCog,
} from "lucide-react";

import { MiniVoiceButton } from "@/components/mini-voice-button";
import { ShareButton } from "@/components/share-button";

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

type CardVariant = "default" | "large" | "compact";
type Locale = "bn" | "en";

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

const COUNTRY_CODE_MAP: Record<string, string> = {
  "saudi arabia": "SA",
  saudi: "SA",
  ksa: "SA",
  "সৌদি আরব": "SA",
  "সৌদি": "SA",
  qatar: "QA",
  "কাতার": "QA",
  oman: "OM",
  "ওমান": "OM",
  bahrain: "BH",
  "বাহরাইন": "BH",
  kuwait: "KW",
  "কুয়েত": "KW",
  "সংযুক্ত আরব আমিরাত": "AE",
  "ইউএই": "AE",
  "united arab emirates": "AE",
  uae: "AE",
  dubai: "AE",
  abu_dhabi: "AE",
  malaysia: "MY",
  "মালয়েশিয়া": "MY",
  "মালয়েশিয়া": "MY",
  singapore: "SG",
  "সিঙ্গাপুর": "SG",
  japan: "JP",
  "জাপান": "JP",
  "south korea": "KR",
  korea: "KR",
  romania: "RO",
  "রোমানিয়া": "RO",
  italy: "IT",
  "ইতালি": "IT",
  germany: "DE",
  poland: "PL",
  portugal: "PT",
  croatia: "HR",
  greece: "GR",
  canada: "CA",
  usa: "US",
  "united states": "US",
  america: "US",
  australia: "AU",
  jordan: "JO",
  "জর্ডান": "JO",
  iraq: "IQ",
  brunei: "BN",
  "ব্রুনাই": "BN",
  maldives: "MV",
  "মালদ্বীপ": "MV",
  "united kingdom": "GB",
  uk: "GB",
};

const TEXT = {
  bn: {
    opportunity: "সুযোগ",
    officialPartner: "অফিশিয়াল পার্টনার",
    officialSource: "অফিশিয়াল সোর্স",
    verifiedSource: "যাচাইকৃত উৎস",
    suitableForBd: "বাংলাদেশিদের জন্য উপযুক্ত",
    needsReview: "রিভিউ প্রয়োজন",
    summaryFallback: "এই সুযোগ সম্পর্কে বিস্তারিত জানতে বিস্তারিত পেজ দেখুন।",
    deadlineMissing: "শেষ তারিখ উল্লেখ নেই",
    details: "বিস্তারিত দেখুন",
    companyMissing: "প্রতিষ্ঠানের নাম উল্লেখ নেই",
    companyLabel: "প্রতিষ্ঠান",
    locationLabel: "লোকেশন",
    categoryLabel: "ক্যাটাগরি",
    skillLabel: "দক্ষতার স্তর",
    deadlineLabel: "শেষ তারিখ",
    trustOfficial: "অফিশিয়াল সোর্স থেকে সংগৃহীত",
    trustPartner: "অফিশিয়াল পার্টনার থেকে সংগৃহীত",
    trustVerified: "যাচাইকৃত উৎস থেকে সংগৃহীত",
    trustReview: "কিছু তথ্য যাচাই করা প্রয়োজন",
    save: "সংরক্ষণ করুন",
    removeSave: "সংরক্ষণ বাতিল করুন",
    listen: "চাকরির তথ্য শুনুন",
    share: "শেয়ার করুন",
    matchPrefix: "কেন উপযুক্ত",
    matchFallback: "আপনার প্রোফাইলের সঙ্গে এই সুযোগের মিল আছে।",
  },
  en: {
    opportunity: "Opportunity",
    officialPartner: "Official Partner",
    officialSource: "Official Source",
    verifiedSource: "Verified Source",
    suitableForBd: "Suitable for Bangladeshis",
    needsReview: "Needs Review",
    summaryFallback: "See the detail page to learn more about this opportunity.",
    deadlineMissing: "Deadline not mentioned",
    details: "See Details",
    companyMissing: "Company not mentioned",
    companyLabel: "Company",
    locationLabel: "Location",
    categoryLabel: "Category",
    skillLabel: "Skill level",
    deadlineLabel: "Deadline",
    trustOfficial: "Collected from an official source",
    trustPartner: "Collected from an official partner",
    trustVerified: "Collected from a verified source",
    trustReview: "Some information needs review",
    save: "Save this opportunity",
    removeSave: "Remove from saved",
    listen: "Listen to this job",
    share: "Share",
    matchPrefix: "Why it fits",
    matchFallback: "This opportunity matches your profile.",
  },
} as const;

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[().,]/g, "")
    .replace(/\s+/g, " ");
}

function countryToCode(country: string | null | undefined): string | null {
  if (!country) return null;
  const trimmed = country.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return COUNTRY_CODE_MAP[normalizeKey(trimmed)] ?? null;
}

function parseDateOnlyUtc(dateString: string) {
  const [year, month, day] = dateString.split("-").map((value) => Number(value));
  if (!year || !month || !day) {
    return null;
  }

  return Date.UTC(year, month - 1, day);
}

function daysUntil(deadline: string | null | undefined) {
  if (!deadline) {
    return null;
  }

  const targetUtc = parseDateOnlyUtc(deadline);
  if (targetUtc == null) {
    return null;
  }

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.ceil((targetUtc - todayUtc) / 86400000);
}

function formatExperienceYears(value: number | null | undefined, locale: Locale) {
  if (value == null) {
    return null;
  }

  const formatted = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);

  return locale === "bn" ? `${formatted} বছরের` : `${formatted} years`;
}

function formatExperienceCallout(value: number | null | undefined, locale: Locale) {
  const years = formatExperienceYears(value, locale);
  if (!years) {
    return null;
  }

  return locale === "bn" ? `${years} অভিজ্ঞতা প্রয়োজন` : `${years} of experience needed`;
}

function typeLabel(type: string | null | undefined, locale: Locale) {
  if (!type) {
    return TEXT[locale].opportunity;
  }

  const label = TYPE_LABELS[type as keyof typeof TYPE_LABELS];
  return label ? label[locale] : type;
}

function isOfficialSourceLabel(value: string | null | undefined) {
  return Boolean(value && /(সরকারি উৎস|official source|government source)/i.test(value));
}

function isOfficialPartnerLabel(value: string | null | undefined) {
  return Boolean(value && /(অফিশিয়াল পার্টনার|official partner)/i.test(value));
}

function isVerifiedSourceLabel(value: string | null | undefined) {
  return Boolean(value && /(যাচাইকৃত|verified)/i.test(value));
}

function needsReview(item: RichCardItem) {
  return (item.risk_flags ?? []).length > 0;
}

function topBadges(item: RichCardItem, locale: Locale) {
  const badges: Array<{ label: string; tone: "default" | "positive" | "warning" }> = [
    { label: typeLabel(item.opportunity_type, locale), tone: "default" },
  ];

  if (isOfficialPartnerLabel(item.source_trust_badge)) {
    badges.push({ label: TEXT[locale].officialPartner, tone: "positive" });
  } else if (isOfficialSourceLabel(item.source_trust_badge)) {
    badges.push({ label: TEXT[locale].officialSource, tone: "positive" });
  } else if (isVerifiedSourceLabel(item.source_trust_badge)) {
    badges.push({ label: TEXT[locale].verifiedSource, tone: "positive" });
  }

  if (item.can_apply_from_bd) {
    badges.push({ label: TEXT[locale].suitableForBd, tone: "positive" });
  }

  if (needsReview(item)) {
    badges.push({ label: TEXT[locale].needsReview, tone: "warning" });
  }

  return badges;
}

function trustText(item: RichCardItem, locale: Locale) {
  if (needsReview(item)) {
    return TEXT[locale].trustReview;
  }

  if (isOfficialPartnerLabel(item.source_trust_badge)) {
    return TEXT[locale].trustPartner;
  }

  if (isOfficialSourceLabel(item.source_trust_badge)) {
    return TEXT[locale].trustOfficial;
  }

  if (isVerifiedSourceLabel(item.source_trust_badge)) {
    return TEXT[locale].trustVerified;
  }

  return TEXT[locale].trustReview;
}

function matchReason(item: AnyCard, locale: Locale) {
  const explicit = item.why_this_matches?.trim();
  if (explicit) {
    return explicit;
  }

  const iscMatchKey = "isc_match_key" in item ? item.isc_match_key : null;
  if (iscMatchKey) {
    const sector = ISC_SECTORS.find((entry) => entry.key === iscMatchKey);
    if (sector) {
      return locale === "en"
        ? `You selected ${sector.en}, so this opportunity is relevant.`
        : `আপনি ${sector.bn} বেছে নিয়েছেন, তাই এই সুযোগটি প্রাসঙ্গিক।`;
    }
  }

  if (item.can_apply_from_bd) {
    return locale === "en"
      ? "You can apply directly from Bangladesh."
      : "বাংলাদেশ থেকে সরাসরি আবেদন করা যেতে পারে।";
  }

  return TEXT[locale].matchFallback;
}

function summaryText(item: RichCardItem, locale: Locale) {
  return pickLang(item, "summary", locale) ?? TEXT[locale].summaryFallback;
}

function titleText(item: RichCardItem, locale: Locale) {
  return pickLang(item, "title", locale) ?? item.title;
}

function companyText(item: RichCardItem, locale: Locale) {
  return item.employer_or_organization?.trim() || item.source_name?.trim() || TEXT[locale].companyMissing;
}

function categoryText(item: RichCardItem, locale: Locale) {
  const iscCategory = getISCSectorByKey(item.isc_category_key);
  if (iscCategory) {
    return locale === "en" ? iscCategory.en : iscCategory.bn;
  }
  return pickLang(item, "platform_category", locale) ?? item.sector ?? null;
}

function fallbackLocationText(item: RichCardItem) {
  const parts = [item.city, item.destination_country, item.country]
    .filter((value): value is string => Boolean(value && value.trim()))
    .filter((value, index, values) => values.indexOf(value) === index);

  return parts.length > 0 ? parts.join(", ") : null;
}

function cardVoiceText(item: RichCardItem, locale: Locale, title: string, summary: string) {
  if (locale !== "bn") {
    return `${title}. ${summary}`.trim();
  }

  const titleVoice = getVoiceField(item, "title", "bn");
  const employerVoice = joinVoiceParts([
    getVoiceField(item, "employer_or_organization", "bn") ?? getVoiceField(item, "source_name", "bn"),
  ], "bn");
  const locationVoice = joinVoiceParts([
    getVoiceField(item, "location_text", "bn"),
    getVoiceField(item, "destination_country", "bn") ?? getVoiceField(item, "country", "bn"),
  ], "bn");
  const deadlineVoice = formatVoiceDate(item.deadline, "bn");
  const summaryVoice = getVoiceField(item, "summary", "bn");

  return (
    joinVoiceParts(
      [
        titleVoice,
        employerVoice ? `নিয়োগকর্তা, ${employerVoice}` : null,
        locationVoice ? `লোকেশন, ${locationVoice}` : null,
        deadlineVoice ? `আবেদনের শেষ তারিখ, ${deadlineVoice}` : null,
        summaryVoice ? `সারসংক্ষেপ, ${summaryVoice}` : null,
      ],
      "bn",
    ) ?? ""
  );
}

function getTrustStatus(item: RichCardItem, locale: Locale) {
  if (isOfficialPartnerLabel(item.source_trust_badge)) {
    return {
      label: locale === "bn" ? "অফিশিয়াল পার্টনার" : "Official Partner",
      tone: "positive" as const,
      description: locale === "bn" ? "অফিশিয়াল পার্টনার থেকে সংগৃহীত" : "Collected from an official partner",
    };
  }
  if (isOfficialSourceLabel(item.source_trust_badge)) {
    return {
      label: locale === "bn" ? "অফিশিয়াল সোর্স" : "Official Source",
      tone: "positive" as const,
      description: locale === "bn" ? "অফিশিয়াল সোর্স থেকে সংগৃহীত" : "Collected from an official source",
    };
  }
  if (isVerifiedSourceLabel(item.source_trust_badge)) {
    return {
      label: locale === "bn" ? "যাচাইকৃত উৎস" : "Verified Source",
      tone: "positive" as const,
      description: locale === "bn" ? "যাচাইকৃত উৎস থেকে সংগৃহীত" : "Collected from a verified source",
    };
  }
  // Unknown or Needs Review
  return {
    label: locale === "bn" ? "যাচাই প্রয়োজন" : "Needs Verification",
    tone: "warning" as const,
    description: locale === "bn" ? "তথ্য যাচাই করে আবেদন করুন" : "Verify information before applying",
  };
}

function getFormattedSalary(item: RichCardItem, locale: Locale) {
  const text = pickLang(item, "salary_text", locale)?.trim();
  if (text) return text;
  if (item.salary_min != null) {
    const currency = item.salary_currency ?? "BDT";
    const min = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(item.salary_min);
    if (item.salary_max != null) {
      const max = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(item.salary_max);
      return `${min} - ${max} ${currency}`;
    }
    return `${min} ${currency}`;
  }
  return locale === "bn" ? "বেতন উল্লেখ নেই" : "Salary not mentioned";
}

function getApplyFromBdText(item: RichCardItem, locale: Locale) {
  if (item.can_apply_from_bd === true) {
    return locale === "bn" ? "বাংলাদেশ থেকে আবেদন: হ্যাঁ" : "Apply from Bangladesh: Yes";
  }
  if (item.can_apply_from_bd === false) {
    return locale === "bn" ? "বাংলাদেশ থেকে আবেদন: না" : "Apply from Bangladesh: No";
  }
  return locale === "bn" ? "বাংলাদেশ থেকে আবেদন: জানা নেই" : "Apply from Bangladesh: Unknown";
}

function countryText(item: RichCardItem, locale: Locale) {
  return item.destination_country ?? item.country ?? pickLang(item, "location_text", locale) ?? fallbackLocationText(item);
}


function locationDetailText(item: RichCardItem, locale: Locale) {
  const country = item.destination_country ?? item.country;
  const localizedLocation = pickLang(item, "location_text", locale)?.trim();
  const city = item.city?.trim();

  if (localizedLocation && localizedLocation !== country) {
    return localizedLocation;
  }

  if (city) {
    return country ? `${city}, ${country}` : city;
  }

  return null;
}

function detailsHref(item: RichCardItem): Route {
  return `/opportunity/${item.id}` as Route;
}

function metadataItems(item: RichCardItem, locale: Locale) {
  const itemsToRender = [
    {
      key: "company",
      icon: BriefcaseBusiness,
      label: TEXT[locale].companyLabel,
      value: companyText(item, locale),
    },
    {
      key: "location",
      icon: MapPin,
      label: TEXT[locale].locationLabel,
      value: locationDetailText(item, locale),
    },
    {
      key: "category",
      icon: Tag,
      label: TEXT[locale].categoryLabel,
      value: categoryText(item, locale),
    },
    {
      key: "skill",
      icon: UserRoundCog,
      label: TEXT[locale].skillLabel,
      value: item.skill_level ?? null,
    },
    {
      key: "deadline",
      icon: CalendarClock,
      label: TEXT[locale].deadlineLabel,
      value: item.deadline ? formatDate(item.deadline, locale) : TEXT[locale].deadlineMissing,
      emphasis: !item.deadline || (daysUntil(item.deadline) ?? 99) <= 7,
    },
  ];

  return itemsToRender.filter((entry) => Boolean(entry.value));
}

function compactFacts(item: RichCardItem, locale: Locale) {
  const facts = [
    companyText(item, locale),
    categoryText(item, locale),
    item.deadline ? `${TEXT[locale].deadlineLabel}: ${formatDate(item.deadline, locale)}` : TEXT[locale].deadlineMissing,
  ];

  return facts.filter(Boolean).slice(0, 3);
}

function badgeClasses(tone: "default" | "positive" | "warning") {
  if (tone === "positive") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-teal-200 bg-teal-50 text-teal-700";
}

function flagChipClasses(variant: "large" | "compact") {
  return variant === "large"
    ? "fade-up rounded-full border border-emerald-100 bg-white/80 backdrop-blur-sm px-4 py-2 text-base font-bold text-slate-700 shadow-sm"
    : "fade-up rounded-full border border-slate-200 bg-white/80 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm";
}

function SaveButton({
  saved,
  saving,
  onClick,
  locale,
}: {
  saved: boolean;
  saving: boolean;
  onClick: () => void;
  locale: Locale;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      aria-label={saved ? TEXT[locale].removeSave : TEXT[locale].save}
      className={cn(
        "touch-target inline-flex h-11 w-11 items-center justify-center rounded-2xl border bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50",
        saved
          ? "border-primary/30 text-primary"
          : "border-border text-muted-foreground hover:border-primary hover:text-primary",
      )}
    >
      {saved ? <BookmarkCheck className="h-[18px] w-[18px]" /> : <Bookmark className="h-[18px] w-[18px]" />}
    </button>
  );
}

export function OpportunityCard({
  item,
  onSavedChange,
  variant = "default",
  showMatchBanner = false,
}: {
  item: RichCardItem;
  onSavedChange?: (saved: boolean) => void;
  variant?: CardVariant;
  showMatchBanner?: boolean;
}) {
  const locale = useLocale() as Locale;
  const [saved, setSaved] = useState(item.is_saved);
  const [saving, setSaving] = useState(false);

  const resolvedVariant = variant === "default" ? "large" : variant;
  const title = titleText(item, locale);
  const summary = summaryText(item, locale);
  const detailUrl = detailsHref(item);
  const country = countryText(item, locale);
  const countryCode = countryToCode(country);
  const badges = topBadges(item, locale);
  const facts = metadataItems(item, locale);
  const compactItemFacts = compactFacts(item, locale);
  const experienceCallout = formatExperienceCallout(item.experience_min_years, locale);
  const trust = trustText(item, locale);
  const matchText = showMatchBanner ? matchReason(item, locale) : null;
  const spokenText = cardVoiceText(item, locale, title, summary);

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

  if (resolvedVariant === "compact") {
    return (
      <article className="relative overflow-hidden flex h-full flex-col rounded-[26px] border border-slate-200 bg-white shadow-card transition-all hover:border-primary/20 hover:shadow-card-hover">
        {/* Faded Background Flag (Top Right) */}
        {countryCode ? (
          <div className="absolute top-0 right-0 w-36 h-28 pointer-events-none select-none z-0 overflow-hidden rounded-tr-[26px] opacity-[0.18] dark:opacity-[0.24]">
            <img
              src={`https://flagcdn.com/w160/${countryCode.toLowerCase()}.png`}
              alt=""
              className="w-full h-full object-cover object-right-top"
            />
            {/* Gradient Overlays to fade the flag to the bottom and left */}
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-white/50 to-white dark:via-slate-900/50 dark:to-slate-900" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-white dark:via-slate-900/50 dark:to-slate-900" />
          </div>
        ) : null}

        <div className="relative z-10 flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {badges.slice(0, 3).map((badge) => (
                <span
                  key={`${item.id}-${badge.label}`}
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none",
                    badgeClasses(badge.tone),
                  )}
                >
                  {badge.label}
                </span>
              ))}
            </div>

            {country ? (
              <div className={cn("shrink-0 inline-flex items-center gap-1.5", flagChipClasses("compact"))}>
                {countryCode ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://flagcdn.com/w20/${countryCode.toLowerCase()}.png`}
                    width={16}
                    height={12}
                    alt=""
                    className="rounded-[2px] object-cover"
                  />
                ) : null}
                <span>{country}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold leading-6 text-slate-900">
                <Link href={detailUrl} className="line-clamp-2 hover:text-primary">
                  {title}
                </Link>
              </h3>
              {experienceCallout ? (
                <p className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{experienceCallout}</span>
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <MiniVoiceButton
                text={spokenText}
                locale={locale}
                size="touch"
                ariaLabel={TEXT[locale].listen}
                className="border-border"
                disabled={!spokenText}
              />
              <SaveButton saved={saved} saving={saving} onClick={toggleSave} locale={locale} />
            </div>
          </div>

          <div className="mt-3 space-y-2 flex-1">
            {compactItemFacts.map((fact) => (
              <p key={`${item.id}-${fact}`} className="line-clamp-1 text-sm text-slate-600">
                {fact}
              </p>
            ))}
            <p className="line-clamp-2 text-sm leading-6 text-slate-600">{summary}</p>
          </div>

          <div className="mt-4 flex items-center justify-end pt-2">
            <Link
              href={detailUrl}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {TEXT[locale].details}
            </Link>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-card transition-all hover:border-primary/20 hover:shadow-card-hover">
      {/* Faded Background Flag (Top Right) */}
      {countryCode ? (
        <div className="absolute top-0 right-0 w-48 h-36 md:w-56 md:h-40 pointer-events-none select-none z-0 overflow-hidden rounded-tr-[30px] opacity-[0.18] dark:opacity-[0.24]">
          <img
            src={`https://flagcdn.com/w320/${countryCode.toLowerCase()}.png`}
            alt=""
            className="w-full h-full object-cover object-right-top"
          />
          {/* Gradient Overlays to fade the flag to the bottom and left */}
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-white/50 to-white dark:via-slate-900/50 dark:to-slate-900" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-white dark:via-slate-900/50 dark:to-slate-900" />
        </div>
      ) : null}

      <div className="relative z-10 p-4 sm:p-5 lg:p-6">
        {matchText ? (
          <div className="mb-4 rounded-2xl border border-teal-200 bg-teal-50 px-3.5 py-3 text-sm text-teal-800">
            <p className="font-semibold">{TEXT[locale].matchPrefix}</p>
            <p className="mt-1 line-clamp-2">{matchText}</p>
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span
                key={`${item.id}-${badge.label}`}
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none",
                  badgeClasses(badge.tone),
                )}
              >
                {badge.label}
              </span>
            ))}
          </div>

          {country ? (
            <div className={cn("shrink-0 inline-flex items-center gap-1.5", flagChipClasses("large"))}>
              {countryCode ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://flagcdn.com/w20/${countryCode.toLowerCase()}.png`}
                  width={20}
                  height={15}
                  alt=""
                  className="rounded-[2px] object-cover"
                />
              ) : null}
              <span>{country}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold leading-7 text-slate-900 sm:text-xl">
              <Link href={detailUrl} className="break-words hover:text-primary">
                {title}
              </Link>
            </h3>
            {experienceCallout ? (
              <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-800">
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>{experienceCallout}</span>
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <MiniVoiceButton
              text={spokenText}
              locale={locale}
              size="touch"
              ariaLabel={TEXT[locale].listen}
              className="border-border"
              disabled={!spokenText}
            />
            <SaveButton saved={saved} saving={saving} onClick={toggleSave} locale={locale} />
          </div>
        </div>

        <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {/* Salary Fact */}
          <li className="flex items-start gap-2.5 rounded-2xl bg-slate-50/80 p-3 text-slate-700">
            <BriefcaseBusiness className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {locale === "bn" ? "বেতন" : "Salary"}
              </p>
              <p className="text-sm font-semibold text-slate-900 truncate">
                {getFormattedSalary(item, locale)}
              </p>
            </div>
          </li>

          {/* Deadline Fact */}
          {(() => {
            const isUrgent = item.deadline ? (daysUntil(item.deadline) ?? 99) <= 7 : false;
            return (
              <li className={cn(
                "flex items-start gap-2.5 rounded-2xl p-3",
                isUrgent ? "bg-amber-50 text-amber-800" : "bg-slate-50/80 text-slate-700"
              )}>
                <CalendarClock className={cn("mt-0.5 h-4 w-4 shrink-0", isUrgent ? "text-amber-600" : "text-slate-400")} />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    {locale === "bn" ? "শেষ তারিখ" : "Deadline"}
                  </p>
                  <p className="text-sm font-semibold text-current truncate">
                    {item.deadline ? formatDate(item.deadline, locale) : (locale === "bn" ? "শেষ তারিখ উল্লেখ নেই" : "Deadline not mentioned")}
                  </p>
                </div>
              </li>
            );
          })()}

          {/* Apply from Bangladesh Fact */}
          <li className="flex items-start gap-2.5 rounded-2xl bg-slate-50/80 p-3 text-slate-700">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {locale === "bn" ? "বাংলাদেশ থেকে আবেদন" : "Apply from BD"}
              </p>
              <p className="text-sm font-semibold text-slate-900 truncate">
                {getApplyFromBdText(item, locale)}
              </p>
            </div>
          </li>

          {/* Safety / Verification Fact */}
          {(() => {
            const status = getTrustStatus(item, locale);
            const isWarning = status.tone === "warning";
            return (
              <li className={cn(
                "flex items-start gap-2.5 rounded-2xl p-3",
                isWarning ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-slate-50/80 text-slate-700"
              )}>
                {isWarning ? (
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                ) : (
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                )}
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    {locale === "bn" ? "নিরাপত্তা" : "Safety"}
                  </p>
                  <p className="text-sm font-semibold text-current truncate" title={status.description}>
                    {status.description}
                  </p>
                </div>
              </li>
            );
          })()}
        </ul>

        <p className="mt-3.5 line-clamp-2 text-sm leading-relaxed text-slate-600">{summary}</p>

        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
              {needsReview(item) ? (
                <CircleAlert className="h-4 w-4 shrink-0 text-amber-600" />
              ) : (
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              )}
              <p className="line-clamp-2">{trust}</p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <ShareButton
                url={detailUrl}
                title={title}
                mode="quick"
                showLabel={false}
                ariaLabel={TEXT[locale].share}
              />
              <Link
                href={detailUrl}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                {TEXT[locale].details}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
