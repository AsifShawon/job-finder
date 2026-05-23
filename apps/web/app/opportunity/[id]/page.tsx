import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Briefcase,
  Calendar,
  CheckCircle,
  ExternalLink,
  FileText,
  MapPin,
  ShieldCheck,
} from "lucide-react";

import { BilingualSummary } from "@/components/bilingual-summary";
import { OpportunityCard } from "@/components/opportunity-card";
import { OpportunityVoicePlayer, type VoiceSection } from "@/components/opportunity-voice-player";
import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getOpportunity, getSimilar } from "@/lib/api";
import { getLocale } from "@/lib/i18n";
import { pickLang, pickLangList } from "@/lib/i18n-shared";
import { formatDate, formatDateTime, humanizeSlug } from "@/lib/utils";
import { buildNarratedVoiceText, formatVoiceDate, getVoiceField, getVoiceList, joinVoiceParts } from "@/lib/voice-script";

interface OpportunityDetailProps {
  params: Promise<{ id: string }>;
}

function TrustTierBadge({
  tier,
  locale,
}: {
  tier: string | null | undefined;
  locale: "bn" | "en";
}) {
  if (tier === "official_gov") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-700/30 dark:bg-emerald-900/20 dark:text-emerald-400">
        <ShieldCheck className="h-3.5 w-3.5" />
        {locale === "en" ? "Government source" : "সরকারি উৎস"}
      </span>
    );
  }

  if (!tier) {
    return null;
  }

  return <Badge variant="outline">{humanizeSlug(tier, locale)}</Badge>;
}

function DetailAccordion({
  title,
  content,
  defaultOpen = false,
}: {
  title: string;
  content: string | string[] | null | undefined;
  defaultOpen?: boolean;
}) {
  if (!content || (Array.isArray(content) && content.length === 0)) {
    return null;
  }

  return (
    <details
      open={defaultOpen}
      className="rounded-2xl border border-border bg-card p-4 shadow-card"
    >
      <summary className="cursor-pointer list-none text-base font-semibold text-foreground">
        {title}
      </summary>
      <div className="mt-3 space-y-2 text-muted-foreground">
        {Array.isArray(content) ? (
          content.map((item, index) => <p key={`${title}-${index}`}>{item}</p>)
        ) : (
          <p>{content}</p>
        )}
      </div>
    </details>
  );
}

function SourceJobDetails({
  sections,
  isEn,
}: {
  sections: Array<{ title: string; items: string[] }>;
  isEn: boolean;
}) {
  if (sections.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          {isEn ? "Source job details" : "মূল চাকরির বিস্তারিত"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEn
            ? "Detailed role information preserved from the official job page."
            : "অফিশিয়াল চাকরির পেজ থেকে পাওয়া বিস্তারিত দায়িত্ব ও যোগ্যতার তথ্য।"}
        </p>
      </div>
      <div className="grid gap-3">
        {sections.map((section) => (
          <Card key={section.title}>
            <h3 className="text-lg font-bold text-foreground">{section.title}</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              {section.items.map((item, index) => (
                <li key={`${section.title}-${index}`} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  );
}

function formatEligibilityValue(
  value: boolean | null | undefined,
  locale: "bn" | "en",
  yesLabel: { bn: string; en: string },
  noLabel: { bn: string; en: string },
) {
  if (value === true) {
    return locale === "en" ? `✅ ${yesLabel.en}` : `✅ ${yesLabel.bn}`;
  }

  if (value === false) {
    return locale === "en" ? `❌ ${noLabel.en}` : `❌ ${noLabel.bn}`;
  }

  return locale === "en" ? "❓ Unknown" : "❓ জানা নেই";
}

function deadlinePill(deadline: string | null, locale: "bn" | "en") {
  if (!deadline) {
    return null;
  }

  const days = Math.ceil(
    (new Date(`${deadline}T00:00:00Z`).getTime() - Date.now()) / 86400000,
  );
  if (days >= 0 && days <= 7) {
    return {
      text: locale === "en" ? `⚡ ${days} days left` : `⚡ মাত্র ${days} দিন বাকি`,
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200",
    };
  }

  return {
    text: formatDate(deadline, locale),
    className: "bg-muted text-foreground",
  };
}

function getNotSpecified(locale: "bn" | "en") {
  return locale === "en" ? "Not specified" : "উল্লেখ নেই";
}

function isRawMetadataText(text: string | null | undefined): boolean {
  if (!text) {
    return false;
  }
  const head = text.slice(0, 600).toLowerCase();
  return [
    "official listing metadata:",
    "job detail page content:",
    "source job id:",
    "apply url:",
    "career details",
    "login view profile",
    "start apply with linkedin",
    "please wait",
  ].some((signal) => head.includes(signal));
}

function sanitizeText(text: string | null | undefined): string | null {
  if (!text || isRawMetadataText(text)) {
    return null;
  }
  const cleaned = text.trim();
  return cleaned.length > 0 ? cleaned : null;
}

function sanitizeList(items: string[] | null | undefined): string[] {
  return (items ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && !isRawMetadataText(item));
}

function sanitizeSections(
  sections: Array<{ title: string; items: string[] }> | null | undefined,
): Array<{ title: string; items: string[] }> {
  return (sections ?? [])
    .map((section) => ({
      title: section.title.trim(),
      items: sanitizeList(section.items),
    }))
    .filter((section) => section.title.length > 0 && section.items.length > 0);
}

function groupLabel(key: string, locale: "bn" | "en") {
  const labels: Record<string, { en: string; bn: string }> = {
    requirements: { en: "Requirements", bn: "প্রয়োজনীয়তা" },
    qualifications: { en: "Qualifications", bn: "যোগ্যতা" },
    responsibilities: { en: "Responsibilities", bn: "দায়িত্ব" },
    key_accountabilities: { en: "Key Accountability Areas", bn: "মূল দায়িত্বের ক্ষেত্র" },
    role_accountabilities: { en: "Role Accountability", bn: "পদের দায়িত্ব" },
    skills: { en: "Technical Skills", bn: "টেকনিক্যাল স্কিল" },
    work_conditions: { en: "Work Experience and Conditions", bn: "কাজের অভিজ্ঞতা ও শর্ত" },
  };
  const label = labels[key];
  if (!label) {
    return key.replaceAll("_", " ");
  }
  return locale === "en" ? label.en : label.bn;
}

export default async function OpportunityDetailPage({
  params,
}: OpportunityDetailProps) {
  const { id } = await params;
  const [opportunity, similar, locale] = await Promise.all([
    getOpportunity(id),
    getSimilar(id),
    getLocale(),
  ]);
  const isEn = locale === "en";
  const opportunityUrl = `/opportunity/${id}`;
  const applyHref = opportunity.application_url ?? opportunity.original_apply_url ?? opportunity.source_url;
  const organization = opportunity.employer ?? opportunity.organization ?? opportunity.employer_or_organization;
  const requirementItems = sanitizeList(opportunity.requirements_json?.items ?? []);
  // Bilingual content — picks the locale's variant, then falls back to the
  // other language, then to the canonical (source-language) value.
  const titleText = pickLang(opportunity, "title", locale) ?? opportunity.title;
  const summaryText =
    pickLang(opportunity, "summary", locale) ??
    (locale === "bn" ? opportunity.summary_bn : opportunity.summary_en) ??
    opportunity.summary;
  const eligibilityText = pickLang(opportunity, "eligibility_text", locale);
  const requiredDocumentsText = pickLang(opportunity, "required_documents", locale);
  const applicationProcessText = pickLang(opportunity, "application_process", locale);
  const educationRequirementText = pickLang(opportunity, "education_requirement", locale);
  const experienceRequirementText = pickLang(opportunity, "experience_requirement", locale);
  const languageRequirementText = pickLang(opportunity, "language_requirement", locale);
  const visaInfoText = pickLang(opportunity, "visa_or_work_permit_info", locale);
  const salaryText = pickLang(opportunity, "salary_text", locale);
  const journeySteps = sanitizeList(pickLangList(opportunity, "journey_steps", locale));
  const documentsNeeded = sanitizeList(pickLangList(opportunity, "documents_needed", locale));
  const cleanSummaryBn = sanitizeText(opportunity.summary_bn);
  const cleanSummaryEn = sanitizeText(opportunity.summary_en);
  const cleanSummaryText = sanitizeText(summaryText);
  const cleanEligibilityText = sanitizeText(eligibilityText);
  const cleanRequiredDocumentsText = sanitizeText(requiredDocumentsText);
  const cleanApplicationProcessText = sanitizeText(applicationProcessText);
  const cleanEducationRequirementText = sanitizeText(educationRequirementText);
  const cleanExperienceRequirementText = sanitizeText(experienceRequirementText);
  const cleanLanguageRequirementText = sanitizeText(languageRequirementText);
  const cleanVisaInfoText = sanitizeText(visaInfoText);
  const groupedSections = Object.entries(opportunity.requirements_json?.groups ?? {})
    .map(([key, items]) => ({
      title: groupLabel(key, locale),
      items: sanitizeList(items),
    }))
    .filter((section) => section.items.length > 0);
  const sourceSections = sanitizeSections(opportunity.source_sections);
  const fallbackSections = [
    sanitizeText(opportunity.job_purpose)
      ? { title: isEn ? "Job Purpose" : "কাজের উদ্দেশ্য", items: [sanitizeText(opportunity.job_purpose)!] }
      : null,
    sanitizeList(opportunity.key_accountabilities).length > 0
      ? { title: isEn ? "Key Accountability Areas" : "মূল দায়িত্বের ক্ষেত্র", items: sanitizeList(opportunity.key_accountabilities) }
      : null,
    sanitizeList(opportunity.role_accountabilities).length > 0
      ? { title: isEn ? "Role Accountability" : "পদের দায়িত্ব", items: sanitizeList(opportunity.role_accountabilities) }
      : null,
    sanitizeList(opportunity.responsibilities).length > 0
      ? { title: isEn ? "Responsibilities" : "দায়িত্ব", items: sanitizeList(opportunity.responsibilities) }
      : null,
    sanitizeList(opportunity.qualifications).length > 0
      ? { title: isEn ? "Qualifications" : "যোগ্যতা", items: sanitizeList(opportunity.qualifications) }
      : null,
    sanitizeList(opportunity.skills).length > 0
      ? { title: isEn ? "Technical Skills" : "টেকনিক্যাল স্কিল", items: sanitizeList(opportunity.skills) }
      : null,
    sanitizeList(opportunity.work_conditions).length > 0
      ? { title: isEn ? "Work Experience and Conditions" : "কাজের অভিজ্ঞতা ও শর্ত", items: sanitizeList(opportunity.work_conditions) }
      : null,
  ].filter((section): section is { title: string; items: string[] } => Boolean(section));
  const richSections = sourceSections.length > 0 ? sourceSections : groupedSections.length > 0 ? groupedSections : fallbackSections;

  const documentDetails = [
    cleanRequiredDocumentsText,
    cleanLanguageRequirementText,
    cleanEducationRequirementText,
  ].filter(Boolean) as string[];
  const processDetails = [
    cleanApplicationProcessText,
    cleanVisaInfoText,
    cleanExperienceRequirementText,
  ].filter(Boolean) as string[];
  const salaryBdt = opportunity.typical_salary_bdt
    ? new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(opportunity.typical_salary_bdt)
    : null;
  const deadlineBadge = deadlinePill(opportunity.deadline, locale);
  const banglaEmployerVoice =
    getVoiceField(opportunity, "employer", "bn") ??
    getVoiceField(opportunity, "organization", "bn") ??
    getVoiceField(opportunity, "employer_or_organization", "bn");
  const banglaLocationVoice =
    getVoiceField(opportunity, "location_text", "bn") ??
    getVoiceField(opportunity, "destination_country", "bn") ??
    getVoiceField(opportunity, "country", "bn");
  const banglaRequirementsVoice = joinVoiceParts(
    [
      getVoiceField(opportunity, "education_requirement", "bn"),
      getVoiceField(opportunity, "experience_requirement", "bn"),
      getVoiceField(opportunity, "language_requirement", "bn"),
    ],
    "bn",
  );
  const banglaStepsVoice = joinVoiceParts(
    [
      getVoiceField(opportunity, "application_process", "bn"),
      ...getVoiceList(opportunity, "journey_steps", "bn"),
    ],
    "bn",
  );
  const banglaDocumentsVoice = joinVoiceParts(
    [
      getVoiceField(opportunity, "required_documents", "bn"),
      ...getVoiceList(opportunity, "documents_needed", "bn"),
    ],
    "bn",
  );

  const voiceSections: VoiceSection[] = [
    { label: isEn ? "Title" : "শিরোনাম", text: titleText },
    { label: isEn ? "Summary" : "সংক্ষেপ", text: cleanSummaryText ?? "" },
    { label: isEn ? "Employer" : "নিয়োগকর্তা", text: organization ?? "" },
    { label: isEn ? "Country" : "দেশ", text: opportunity.destination_country ?? opportunity.country ?? "" },
    { label: isEn ? "Salary" : "বেতন", text: salaryText ?? (opportunity.salary_min != null ? `${opportunity.salary_min} ${opportunity.salary_currency ?? ""}` : "") },
    { label: isEn ? "Deadline" : "শেষ তারিখ", text: opportunity.deadline ? formatDate(opportunity.deadline, locale) : "" },
    { label: isEn ? "Eligibility" : "যোগ্যতা", text: cleanEligibilityText ?? "" },
    { label: isEn ? "Requirements" : "প্রয়োজনীয়তা", text: requirementItems.join(isEn ? ". " : "। ") },
    { label: isEn ? "Steps" : "আবেদনের ধাপ", text: journeySteps.join(isEn ? ". " : "। ") },
    { label: isEn ? "Documents" : "প্রয়োজনীয় কাগজপত্র", text: documentsNeeded.join(isEn ? ". " : "। ") },
  ].filter(s => s.text.trim().length > 0);

  /* const voicePlaybackSections: VoiceSection[] = isEn
    ? voiceSections
    : [
        {
          ...voiceSections[0],
          spokenText: buildNarratedVoiceText("শিরোনাম", getVoiceField(opportunity, "title", "bn"), "bn") ?? undefined,
        },
        {
          ...voiceSections[1],
          spokenText: buildNarratedVoiceText("সারসংক্ষেপ", getVoiceField(opportunity, "summary", "bn"), "bn") ?? undefined,
        },
        {
          ...voiceSections[2],
          spokenText: buildNarratedVoiceText("নিয়োগকর্তা", banglaEmployerVoice, "bn") ?? undefined,
        },
        {
          ...voiceSections[3],
          spokenText: buildNarratedVoiceText("দেশ", banglaLocationVoice, "bn") ?? undefined,
        },
        {
          ...voiceSections[5],
          spokenText: buildNarratedVoiceText("আবেদনের শেষ তারিখ", formatVoiceDate(opportunity.deadline, "bn"), "bn") ?? undefined,
        },
        {
          ...voiceSections[6],
          spokenText: buildNarratedVoiceText("যোগ্যতা", getVoiceField(opportunity, "eligibility_text", "bn"), "bn") ?? undefined,
        },
        {
          ...voiceSections[7],
          spokenText: buildNarratedVoiceText("প্রয়োজনীয়তা", banglaRequirementsVoice, "bn") ?? undefined,
        },
        {
          ...voiceSections[8],
          spokenText: buildNarratedVoiceText("আবেদনের ধাপ", banglaStepsVoice, "bn") ?? undefined,
        },
        {
          ...voiceSections[9],
          spokenText: buildNarratedVoiceText("প্রয়োজনীয় কাগজপত্র", banglaDocumentsVoice, "bn") ?? undefined,
        },
      ].filter((section) => Boolean(section.spokenText?.trim())); */

  const safeVoicePlaybackSections: VoiceSection[] = isEn
    ? voiceSections
    : [
        {
          label: isEn ? "Title" : "à¦¶à¦¿à¦°à§‹à¦¨à¦¾à¦®",
          text: titleText,
          spokenText: buildNarratedVoiceText("শিরোনাম", getVoiceField(opportunity, "title", "bn"), "bn") ?? undefined,
        },
        {
          label: isEn ? "Summary" : "à¦¸à¦‚à¦•à§à¦·à§‡à¦ª",
          text: cleanSummaryText ?? "",
          spokenText: buildNarratedVoiceText("সারসংক্ষেপ", getVoiceField(opportunity, "summary", "bn"), "bn") ?? undefined,
        },
        {
          label: isEn ? "Employer" : "à¦¨à¦¿à¦¯à¦¼à§‹à¦—à¦•à¦°à§à¦¤à¦¾",
          text: organization ?? "",
          spokenText: buildNarratedVoiceText("নিয়োগকর্তা", banglaEmployerVoice, "bn") ?? undefined,
        },
        {
          label: isEn ? "Country" : "à¦¦à§‡à¦¶",
          text: opportunity.destination_country ?? opportunity.country ?? "",
          spokenText: buildNarratedVoiceText("দেশ", banglaLocationVoice, "bn") ?? undefined,
        },
        {
          label: isEn ? "Deadline" : "à¦¶à§‡à¦· à¦¤à¦¾à¦°à¦¿à¦–",
          text: opportunity.deadline ? formatDate(opportunity.deadline, locale) : "",
          spokenText: buildNarratedVoiceText("আবেদনের শেষ তারিখ", formatVoiceDate(opportunity.deadline, "bn"), "bn") ?? undefined,
        },
        {
          label: isEn ? "Eligibility" : "à¦¯à§‹à¦—à§à¦¯à¦¤à¦¾",
          text: cleanEligibilityText ?? "",
          spokenText: buildNarratedVoiceText("যোগ্যতা", getVoiceField(opportunity, "eligibility_text", "bn"), "bn") ?? undefined,
        },
        {
          label: isEn ? "Requirements" : "à¦ªà§à¦°à¦¯à¦¼à§‹à¦œà¦¨à§€à¦¯à¦¼à¦¤à¦¾",
          text: requirementItems.join(isEn ? ". " : "à¥¤ "),
          spokenText: buildNarratedVoiceText("প্রয়োজনীয়তা", banglaRequirementsVoice, "bn") ?? undefined,
        },
        {
          label: isEn ? "Steps" : "à¦†à¦¬à§‡à¦¦à¦¨à§‡à¦° à¦§à¦¾à¦ª",
          text: journeySteps.join(isEn ? ". " : "à¥¤ "),
          spokenText: buildNarratedVoiceText("আবেদনের ধাপ", banglaStepsVoice, "bn") ?? undefined,
        },
        {
          label: isEn ? "Documents" : "à¦ªà§à¦°à¦¯à¦¼à§‹à¦œà¦¨à§€à¦¯à¦¼ à¦•à¦¾à¦—à¦œà¦ªà¦¤à§à¦°",
          text: documentsNeeded.join(isEn ? ". " : "à¥¤ "),
          spokenText: buildNarratedVoiceText("প্রয়োজনীয় কাগজপত্র", banglaDocumentsVoice, "bn") ?? undefined,
        },
      ].filter((section) => Boolean(section.spokenText?.trim()));

  return (
    <main className="bg-background">
      <div className="sticky top-0 z-40 border-b border-border bg-card/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          {deadlineBadge && (
            <span className={"inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold " + deadlineBadge.className}>
              {deadlineBadge.text}
            </span>
          )}
          <a
            href={applyHref}
            target="_blank"
            rel="noreferrer"
            className="touch-target inline-flex items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white"
            aria-label={isEn ? "Apply now" : "আবেদন করুন"}
          >
            {isEn ? "Apply" : "আবেদন করুন"} ↗
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-primary">
            {isEn ? "Home" : "হোম"}
          </Link>
          <span>/</span>
          <Link href="/search" className="transition-colors hover:text-primary">
            {isEn ? "Search" : "অনুসন্ধান"}
          </Link>
          <span>/</span>
          <span className="line-clamp-1 text-foreground">{titleText}</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <section className="space-y-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary uppercase tracking-wider">
                    {opportunity.opportunity_type ? humanizeSlug(opportunity.opportunity_type, locale) : (isEn ? "Opportunity" : "সুযোগ")}
                  </span>
                  <TrustTierBadge tier={opportunity.trust_tier} locale={locale} />
                  {!opportunity.is_active && (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                      {isEn ? "Expired" : "মেয়াদ শেষ"}
                    </span>
                  )}
                </div>

                <h1 className="text-3xl font-extrabold text-foreground sm:text-4xl lg:text-5xl leading-tight">
                  {titleText}
                </h1>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-base text-muted-foreground">
                  {(opportunity.employer || opportunity.organization || organization) && (
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-primary/60" />
                      <span className="font-semibold text-foreground">{opportunity.employer || opportunity.organization || organization}</span>
                    </div>
                  )}
                  {(opportunity.city || opportunity.country) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary/60" />
                      <span>{[opportunity.city, opportunity.country].filter(Boolean).join(", ")}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Facts Summary */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-primary/10">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-sm font-bold text-muted-foreground">{isEn ? "Deadline" : "শেষ তারিখ"}</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">
                    {opportunity.deadline ? formatDate(opportunity.deadline, locale) : (isEn ? "Not specified" : "উল্লেখ নেই")}
                  </p>
                </div>

                <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-emerald-100">
                      <Banknote className="h-5 w-5 text-emerald-700" />
                    </div>
                    <span className="text-sm font-bold text-muted-foreground">{isEn ? "Salary/Funding" : "বেতন বা ফান্ডিং"}</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">
                    {salaryText ?? (opportunity.salary_min != null ? `${opportunity.salary_min} ${opportunity.salary_currency ?? ""}` : (isEn ? "Not specified" : "উল্লেখ নেই"))}
                  </p>
                </div>

                <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-blue-100">
                      <ShieldCheck className="h-5 w-5 text-blue-700" />
                    </div>
                    <span className="text-sm font-bold text-muted-foreground">{isEn ? "Trust Source" : "উৎস ও বিশ্বাস"}</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">
                    {opportunity.trust_tier === "official_gov"
                      ? (isEn ? "Official Government" : "সরাসরি সরকারি উৎস")
                      : (isEn ? "Verified Platform" : "যাচাইকৃত তথ্য")}
                  </p>
                </div>
              </div>
            </section>



            {(cleanSummaryBn || cleanSummaryEn) && (
              <section className="space-y-4">
                <h2 className="text-2xl font-bold text-foreground">
                  {isEn ? "Detailed Summary" : "বিস্তারিত সারসংক্ষেপ"}
                </h2>
                <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <BilingualSummary
                    summaryBn={cleanSummaryBn}
                    summaryEn={cleanSummaryEn}
                    initialLocale={locale}
                  />
                </div>
              </section>
            )}

            <div className="rounded-2xl bg-blue-50 p-4 text-sm text-foreground dark:bg-blue-900/20">
              <h2 className="text-lg font-bold text-foreground">
                {isEn ? "Can you apply for this?" : "এই চাকরিতে আবেদন করতে পারবেন কি?"}
              </h2>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span>{isEn ? "Apply from Bangladesh" : "বাংলাদেশ থেকে আবেদন"}</span>
                  <span className="font-semibold">
                    {formatEligibilityValue(
                      opportunity.can_apply_from_bd,
                      locale,
                      { bn: "হ্যাঁ", en: "Yes" },
                      { bn: "না", en: "No" },
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{isEn ? "Work permit required" : "ওয়ার্ক পারমিট লাগবে"}</span>
                  <span className="font-semibold">
                    {formatEligibilityValue(
                      opportunity.requires_existing_work_permit,
                      locale,
                      { bn: "হ্যাঁ", en: "Yes" },
                      { bn: "না", en: "No" },
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>{isEn ? "International applicants" : "আন্তর্জাতিক প্রার্থী"}</span>
                  <span className="font-semibold">
                    {formatEligibilityValue(
                      opportunity.open_to_international_candidates,
                      locale,
                      { bn: "স্বাগতম", en: "Welcome" },
                      { bn: "না", en: "Not accepted" },
                    )}
                  </span>
                </div>
                {cleanExperienceRequirementText && (
                  <div className="flex items-start justify-between gap-3 border-t border-blue-100 pt-3 dark:border-blue-800">
                    <span>{isEn ? "Experience required" : "অভিজ্ঞতা"}</span>
                    <span className="max-w-[60%] text-right font-semibold">{cleanExperienceRequirementText}</span>
                  </div>
                )}
                <div className="flex items-start justify-between gap-3 border-t border-blue-100 pt-3 dark:border-blue-800">
                  <span>{isEn ? "Visa / Iqama" : "ভিসা / ইকামা"}</span>
                  <span className="max-w-[60%] text-right font-semibold">{cleanVisaInfoText ?? getNotSpecified(locale)}</span>
                </div>
                {cleanEligibilityText && (
                  <div className="flex items-start justify-between gap-3 border-t border-blue-100 pt-3 dark:border-blue-800">
                    <span>{isEn ? "Eligibility note" : "যোগ্যতার নোট"}</span>
                    <span className="max-w-[60%] text-right font-semibold">{cleanEligibilityText}</span>
                  </div>
                )}
              </div>
            </div>

            {salaryBdt && (
              <div className="rounded-xl bg-green-50 p-3 text-center text-lg font-bold text-foreground dark:bg-green-900/20">
                {isEn
                  ? `💰 Estimated monthly income: ৳${salaryBdt}`
                  : `💰 আনুমানিক মাসিক আয়: ৳${salaryBdt} টাকা`}
              </div>
            )}

            <section className="space-y-3" aria-label={isEn ? "Opportunity details" : "সুযোগের বিস্তারিত"}>
              <SourceJobDetails sections={richSections} isEn={isEn} />
              <DetailAccordion
                title={isEn ? "Requirements" : "যা যা লাগবে"}
                content={requirementItems}
                defaultOpen={richSections.length === 0}
              />
              {journeySteps.length > 0 && (
                <Card>
                  <h2 className="section-underline text-xl font-bold text-foreground">
                    {isEn ? "📋 Application steps" : "📋 আবেদনের ধাপগুলো"}
                  </h2>
                  <div className="mt-4 space-y-4">
                    {journeySteps.map((step, index) => (
                      <div key={`${step}-${index}`} className="relative flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                            {index + 1}
                          </span>
                          {index < journeySteps.length - 1 && (
                            <span className="mt-1 h-full w-0.5 bg-primary/30" />
                          )}
                        </div>
                        <p className="pt-1 text-muted-foreground">{step}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {documentsNeeded.length > 0 && (
                <Card>
                  <h2 className="section-underline text-xl font-bold text-foreground">
                    {isEn ? "📄 Documents needed" : "📄 যা যা লাগবে"}
                  </h2>
                  <ul className="mt-4 space-y-2 text-muted-foreground">
                    {documentsNeeded.map((doc, index) => (
                      <li key={`${doc}-${index}`} className="flex items-start gap-2">
                        <span className="text-base">□</span>
                        <span>{doc}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {isEn
                      ? "Keep your documents ready before applying."
                      : "নথি প্রস্তুত রাখুন আবেদনের আগে"}
                  </p>
                </Card>
              )}
              <DetailAccordion
                title={isEn ? "Salary and Support" : "বেতন ও সহায়তা"}
                content={[
                  salaryText,
                  opportunity.salary_min != null
                    ? `${opportunity.salary_min}${opportunity.salary_max ? ` - ${opportunity.salary_max}` : ""} ${opportunity.salary_currency ?? ""}`.trim()
                    : null,
                  opportunity.funding_type,
                ].filter(Boolean) as string[]}
              />
              <DetailAccordion
                title={isEn ? "Documents" : "নথিপত্র"}
                content={documentDetails}
              />
              <DetailAccordion
                title={isEn ? "Application Process" : "আবেদন প্রক্রিয়া"}
                content={processDetails}
              />
            </section>

            {opportunity.document_url && (
              <Card>
                <h2 className="section-underline text-xl font-bold text-foreground">
                  {isEn ? "Official Circular" : "মূল সার্কুলার"}
                </h2>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-900/20">
                      <FileText className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {isEn ? "Download the original document" : "মূল নথি দেখুন"}
                      </p>
                      <p className="text-sm text-muted-foreground">{opportunity.document_url}</p>
                    </div>
                  </div>
                  <a
                    href={opportunity.document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <FileText className="h-4 w-4" />
                    <span>{isEn ? "Open PDF" : "PDF খুলুন"}</span>
                  </a>
                </div>
              </Card>
            )}

            <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div>
                <p className="font-semibold text-foreground">
                  {isEn ? "Safety warning" : "নিরাপত্তা সতর্কতা"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {isEn
                    ? "Verify the employer, official source, and any requested payment before sharing personal documents."
                    : "ব্যক্তিগত নথি বা অর্থ দেওয়ার আগে নিয়োগকারী, সরকারি উৎস, এবং প্রক্রিয়া অবশ্যই যাচাই করুন।"}
                </p>
              </div>
            </div>

            <Link
              href="/search"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              {isEn ? "Back to search" : "অনুসন্ধানে ফিরুন"}
            </Link>
          </div>

          <aside className="space-y-4">
            <Card>
              <a
                href={applyHref}
                target="_blank"
                rel="noreferrer"
                className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
                aria-label={isEn ? "Apply now" : "আবেদন করুন"}
              >
                <ExternalLink className="h-4 w-4" />
                <span>{isEn ? "Apply Now" : "এখনই আবেদন করুন"}</span>
              </a>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {isEn ? "Share" : "শেয়ার"}
                </span>
                <ShareButton url={opportunityUrl} title={titleText} />
              </div>

              <div className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
                {opportunity.deadline && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{isEn ? "Deadline" : "শেষ তারিখ"}</span>
                    <span className="font-semibold text-foreground">{formatDate(opportunity.deadline, locale)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{isEn ? "Added" : "যোগ করা হয়েছে"}</span>
                  <span className="font-semibold text-foreground">{formatDateTime(opportunity.created_at, locale)}</span>
                </div>
                {(opportunity.salary_min != null || salaryText) && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{isEn ? "Salary" : "বেতন"}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                      <Banknote className="h-4 w-4 text-success" />
                      {salaryText ?? `${opportunity.salary_min} ${opportunity.salary_currency ?? ""}`}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {safeVoicePlaybackSections.length > 0 ? (
              <OpportunityVoicePlayer sections={safeVoicePlaybackSections} locale={locale} />
            ) : null}

            {similar.items.length > 0 && (
              <section className="space-y-3">
                <h3 className="section-underline text-base font-semibold text-foreground">
                  {isEn ? "Similar Opportunities" : "একই ধরনের সুযোগ"}
                </h3>
                <div className="space-y-3">
                  {similar.items.slice(0, 3).map((item) => (
                    <OpportunityCard key={item.id} item={item} variant="compact" />
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
