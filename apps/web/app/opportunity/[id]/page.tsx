import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Briefcase,
  Calendar,
  CheckCircle,
  ChevronDown,
  ExternalLink,
  FileText,
  MapPin,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { BilingualSummary } from "@/components/bilingual-summary";
import { OpportunityCard } from "@/components/opportunity-card";
import { OpportunityVoicePlayer, type VoiceSection } from "@/components/opportunity-voice-player";
import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DetailActionButtons } from "@/components/detail-action-buttons";
import { MobileStickyBottomBar } from "@/components/mobile-sticky-bottom-bar";
import { getOpportunity, getSimilar } from "@/lib/api";
import { getLocale, getT } from "@/lib/i18n";
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
  const t = await getT("opportunity");
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

  const q1SpokenBn = joinVoiceParts([
    buildNarratedVoiceText("শিরোনাম", getVoiceField(opportunity, "title", "bn"), "bn"),
    buildNarratedVoiceText("নিয়োগকর্তা", banglaEmployerVoice, "bn"),
    buildNarratedVoiceText("দেশ", banglaLocationVoice, "bn"),
    buildNarratedVoiceText("সারসংক্ষেপ", getVoiceField(opportunity, "summary", "bn"), "bn")
  ], "bn") ?? "";

  const applyBdTextBn = opportunity.can_apply_from_bd === true
    ? "বাংলাদেশ থেকে আবেদন করা যাবে।"
    : opportunity.can_apply_from_bd === false
      ? "বাংলাদেশ থেকে আবেদন করা যাবে না।"
      : "বাংলাদেশ থেকে আবেদন করার বিষয়টি জানা নেই।";
  const permitTextBn = opportunity.requires_existing_work_permit === true
    ? "ওয়ার্ক পারমিট প্রয়োজন।"
    : opportunity.requires_existing_work_permit === false
      ? "ওয়ার্ক পারমিট প্রয়োজন নেই।"
      : "";
  const q2SpokenBn = joinVoiceParts([
    applyBdTextBn,
    permitTextBn,
    cleanEligibilityText ? `যোগ্যতা, ${cleanEligibilityText}` : null,
    cleanEducationRequirementText ? `শিক্ষাগত যোগ্যতা, ${cleanEducationRequirementText}` : null,
    cleanExperienceRequirementText ? `অভিজ্ঞতা, ${cleanExperienceRequirementText}` : null,
    cleanLanguageRequirementText ? `ভাষার দক্ষতা, ${cleanLanguageRequirementText}` : null
  ], "bn") ?? "";

  const q3SpokenBn = joinVoiceParts([
    salaryText ? `বেতন ও সুবিধা, ${salaryText}` : (opportunity.salary_min != null ? `বেতন, ${opportunity.salary_min} ${opportunity.salary_currency ?? ""}` : "এই উৎসে বেতন বা সুবিধার তথ্য স্পষ্টভাবে দেওয়া নেই।"),
    salaryBdt ? `আনুমানিক মাসিক আয়, ${salaryBdt} টাকা` : null
  ], "bn") ?? "";

  const q4SpokenBn = joinVoiceParts([
    cleanRequiredDocumentsText ? `প্রয়োজনীয় কাগজপত্র, ${cleanRequiredDocumentsText}` : null,
    documentsNeeded.length > 0 ? `প্রয়োজনীয় নথিপত্র, ${documentsNeeded.join("। ")}` : "কাগজপত্রের তালিকা উল্লেখ নেই।"
  ], "bn") ?? "";

  const q5SpokenBn = joinVoiceParts([
    banglaStepsVoice ? `আবেদনের ধাপ, ${banglaStepsVoice}` : null,
    "নিরাপত্তা সতর্কতা, ব্যক্তিগত নথি বা টাকা দেওয়ার আগে নিয়োগকারী ও অফিসিয়াল উৎস যাচাই করুন।"
  ], "bn") ?? "";

  const q1SpokenEn = joinVoiceParts([
    buildNarratedVoiceText("Title", titleText, "en"),
    buildNarratedVoiceText("Employer", organization, "en"),
    buildNarratedVoiceText("Location", opportunity.destination_country ?? opportunity.country, "en"),
    buildNarratedVoiceText("Summary", cleanSummaryText, "en")
  ], "en") ?? "";

  const applyBdTextEn = opportunity.can_apply_from_bd === true
    ? "You can apply from Bangladesh."
    : opportunity.can_apply_from_bd === false
      ? "You cannot apply from Bangladesh."
      : "Apply from Bangladesh is unknown.";
  const permitTextEn = opportunity.requires_existing_work_permit === true
    ? "Work permit is required."
    : opportunity.requires_existing_work_permit === false
      ? "Work permit is not required."
      : "";
  const q2SpokenEn = joinVoiceParts([
    applyBdTextEn,
    permitTextEn,
    cleanEligibilityText,
    cleanEducationRequirementText ? `Education: ${cleanEducationRequirementText}` : null,
    cleanExperienceRequirementText ? `Experience: ${cleanExperienceRequirementText}` : null,
    cleanLanguageRequirementText ? `Language: ${cleanLanguageRequirementText}` : null
  ], "en") ?? "";

  const q3SpokenEn = joinVoiceParts([
    salaryText ? `Salary and benefits: ${salaryText}` : (opportunity.salary_min != null ? `Salary: ${opportunity.salary_min} ${opportunity.salary_currency ?? ""}` : "This source does not clearly mention salary or benefits."),
    salaryBdt ? `Estimated monthly income: ${salaryBdt} BDT` : null
  ], "en") ?? "";

  const q4SpokenEn = joinVoiceParts([
    cleanRequiredDocumentsText ? `Required documents: ${cleanRequiredDocumentsText}` : null,
    documentsNeeded.length > 0 ? `Documents needed: ${documentsNeeded.join(". ")}` : "Documents are not listed."
  ], "en") ?? "";

  const q5SpokenEn = joinVoiceParts([
    cleanApplicationProcessText ? `Application steps: ${cleanApplicationProcessText}` : null,
    journeySteps.length > 0 ? `Journey steps: ${journeySteps.join(". ")}` : null,
    "Safety warning: Before sharing documents or paying money, verify the employer and official source."
  ], "en") ?? "";

  const safeVoicePlaybackSections: VoiceSection[] = isEn
    ? [
        { label: "1. What is this job?", text: q1SpokenEn, spokenText: q1SpokenEn },
        { label: "2. Can I apply?", text: q2SpokenEn, spokenText: q2SpokenEn },
        { label: "3. Salary and benefits", text: q3SpokenEn, spokenText: q3SpokenEn },
        { label: "4. Documents needed", text: q4SpokenEn, spokenText: q4SpokenEn },
        { label: "5. How to apply safely", text: q5SpokenEn, spokenText: q5SpokenEn },
      ].filter(s => s.text.trim().length > 0)
    : [
        { label: "১. এই চাকরিটা কী?", text: q1SpokenBn, spokenText: q1SpokenBn },
        { label: "২. আমি আবেদন করতে পারবো?", text: q2SpokenBn, spokenText: q2SpokenBn },
        { label: "৩. বেতন/সুবিধা কত?", text: q3SpokenBn, spokenText: q3SpokenBn },
        { label: "৪. কী কী কাগজ লাগবে?", text: q4SpokenBn, spokenText: q4SpokenBn },
        { label: "৫. কীভাবে নিরাপদে আবেদন করবো?", text: q5SpokenBn, spokenText: q5SpokenBn },
      ].filter(s => s.text.trim().length > 0);

  return (
    <main className="bg-background pb-24 md:pb-6">
      {/* Mobile Sticky Bottom Action Bar */}
      <MobileStickyBottomBar
        opportunityId={id}
        initialSaved={opportunity.is_saved}
        applyHref={applyHref}
        locale={locale}
      />

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

        {/* Safe Apply Guide Header */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary uppercase tracking-wider">
              {t("safeApplyGuide")}
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
          <p className="text-base text-muted-foreground font-medium">
            {t("safeApplySubtitle")}
          </p>
        </div>

        {/* Top Hero Summary Card */}
        <Card className="p-6 md:p-8 border border-primary/20 shadow-lg bg-gradient-to-br from-card to-primary/5 rounded-[30px] space-y-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{isEn ? "Employer" : "নিয়োগকর্তা"}</span>
              <p className="text-lg font-bold text-foreground flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary shrink-0" />
                <span>{organization ?? getNotSpecified(locale)}</span>
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{isEn ? "Location" : "দেশ/শহর"}</span>
              <p className="text-lg font-bold text-foreground flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary shrink-0" />
                <span>{[opportunity.city, opportunity.destination_country ?? opportunity.country].filter(Boolean).join(", ") || getNotSpecified(locale)}</span>
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{isEn ? "Deadline" : "শেষ তারিখ"}</span>
              <p className="text-lg font-bold text-foreground flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary shrink-0" />
                <span>{opportunity.deadline ? formatDate(opportunity.deadline, locale) : getNotSpecified(locale)}</span>
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{isEn ? "Salary" : "বেতন"}</span>
              <p className="text-lg font-bold text-foreground flex items-center gap-2">
                <Banknote className="h-5 w-5 text-success shrink-0" />
                <span>{salaryText ?? (opportunity.salary_min != null ? `${opportunity.salary_min} ${opportunity.salary_currency ?? ""}` : getNotSpecified(locale))}</span>
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{isEn ? "Source Trust" : "উৎস ও বিশ্বাস"}</span>
              <p className="text-lg font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" />
                <span>
                  {opportunity.trust_tier === "official_gov"
                    ? (isEn ? "Official Government" : "সরাসরি সরকারি উৎস")
                    : (opportunity.trust_tier === "official_partner"
                      ? (isEn ? "Official Partner" : "অফিশিয়াল অংশীদার")
                      : (isEn ? "Verified Platform" : "যাচাইকৃত তথ্য"))}
                </span>
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{isEn ? "Apply from BD" : "বাংলাদেশ থেকে আবেদন"}</span>
              <p className="text-lg font-bold text-foreground flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>
                  {opportunity.can_apply_from_bd === true
                    ? (isEn ? "Yes" : "হ্যাঁ")
                    : opportunity.can_apply_from_bd === false
                      ? (isEn ? "No" : "না")
                      : (isEn ? "Unknown" : "জানা নেই")}
                </span>
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-6 flex flex-wrap items-center justify-between gap-4">
            <DetailActionButtons
              opportunityId={id}
              initialSaved={opportunity.is_saved}
              applyHref={applyHref}
              locale={locale}
              variant="hero"
            />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">{isEn ? "Share:" : "শেয়ার:"}</span>
              <ShareButton url={opportunityUrl} title={titleText} mode="quick" showLabel={false} />
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            
            {/* 5-Question Section Layout */}
            
            {/* Section 1: What is this job? */}
            <Card className="p-6 md:p-8 space-y-4 rounded-[26px] border border-border shadow-sm">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary shrink-0" />
                <span>{t("whatIsThisJob")}</span>
              </h2>
              <div className="pl-7 space-y-4">
                {(cleanSummaryBn || cleanSummaryEn) ? (
                  <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <BilingualSummary
                      summaryBn={cleanSummaryBn}
                      summaryEn={cleanSummaryEn}
                      initialLocale={locale}
                    />
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">{isEn ? "No summary available." : "কোনো সারসংক্ষেপ পাওয়া যায়নি।"}</p>
                )}
                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong className="text-foreground">{isEn ? "Employer:" : "নিয়োগকর্তা:"}</strong> {organization ?? getNotSpecified(locale)}</p>
                  <p><strong className="text-foreground">{isEn ? "Location:" : "লোকেশন:"}</strong> {[opportunity.city, opportunity.destination_country ?? opportunity.country].filter(Boolean).join(", ") || getNotSpecified(locale)}</p>
                  {opportunity.opportunity_type && (
                    <p><strong className="text-foreground">{isEn ? "Job Type:" : "কাজের ধরন:"}</strong> {humanizeSlug(opportunity.opportunity_type, locale)}</p>
                  )}
                </div>
              </div>
            </Card>

            {/* Section 2: Can I apply? */}
            <Card className="p-6 md:p-8 space-y-4 rounded-[26px] border border-border shadow-sm">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                <span>{t("canIApply")}</span>
              </h2>
              <div className="pl-7 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border">
                    <span className="text-sm text-muted-foreground">{t("applyFromBd")}</span>
                    <span className="font-semibold text-sm">
                      {formatEligibilityValue(opportunity.can_apply_from_bd, locale, { bn: "হ্যাঁ", en: "Yes" }, { bn: "না", en: "No" })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border">
                    <span className="text-sm text-muted-foreground">{t("workPermitRequired")}</span>
                    <span className="font-semibold text-sm">
                      {formatEligibilityValue(opportunity.requires_existing_work_permit, locale, { bn: "হ্যাঁ", en: "Yes" }, { bn: "না", en: "No" })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border">
                    <span className="text-sm text-muted-foreground">{t("internationalApplicants")}</span>
                    <span className="font-semibold text-sm">
                      {formatEligibilityValue(opportunity.open_to_international_candidates, locale, { bn: "স্বাগতম", en: "Welcome" }, { bn: "না", en: "No" })}
                    </span>
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3 text-sm">
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-muted-foreground min-w-[120px]">{t("education")}</span>
                    <span className="font-semibold text-foreground text-right">{cleanEducationRequirementText ?? getNotSpecified(locale)}</span>
                  </div>
                  <div className="flex justify-between items-start gap-4 border-t border-slate-100 dark:border-slate-800 pt-2">
                    <span className="text-muted-foreground min-w-[120px]">{t("experience")}</span>
                    <span className="font-semibold text-foreground text-right">{cleanExperienceRequirementText ?? getNotSpecified(locale)}</span>
                  </div>
                  <div className="flex justify-between items-start gap-4 border-t border-slate-100 dark:border-slate-800 pt-2">
                    <span className="text-muted-foreground min-w-[120px]">{t("language")}</span>
                    <span className="font-semibold text-foreground text-right">{cleanLanguageRequirementText ?? getNotSpecified(locale)}</span>
                  </div>
                  <div className="flex justify-between items-start gap-4 border-t border-slate-100 dark:border-slate-800 pt-2">
                    <span className="text-muted-foreground min-w-[120px]">{t("visaIqama")}</span>
                    <span className="font-semibold text-foreground text-right">{cleanVisaInfoText ?? getNotSpecified(locale)}</span>
                  </div>
                  {cleanEligibilityText && (
                    <div className="flex justify-between items-start gap-4 border-t border-slate-100 dark:border-slate-800 pt-2">
                      <span className="text-muted-foreground min-w-[120px]">{isEn ? "Eligibility Note" : "যোগ্যতার নোট"}</span>
                      <span className="font-semibold text-foreground text-right">{cleanEligibilityText}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Section 3: Salary and benefits */}
            <Card className="p-6 md:p-8 space-y-4 rounded-[26px] border border-border shadow-sm">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Banknote className="h-5 w-5 text-primary shrink-0" />
                <span>{t("salaryAndBenefits")}</span>
              </h2>
              <div className="pl-7 space-y-4">
                {(salaryText || opportunity.salary_min != null || salaryBdt) ? (
                  <div className="space-y-3">
                    <p className="text-lg font-bold text-primary">
                      {salaryText ?? `${opportunity.salary_min}${opportunity.salary_max ? ` - ${opportunity.salary_max}` : ""} ${opportunity.salary_currency ?? ""}`}
                    </p>
                    {salaryBdt && (
                      <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 px-4 py-2 text-sm font-bold text-emerald-800 dark:text-emerald-400">
                        <span>💰 {isEn ? `Estimated Monthly Income: ৳${salaryBdt}` : `আনুমানিক মাসিক আয়: ৳${salaryBdt} টাকা`}</span>
                      </div>
                    )}
                    {opportunity.funding_type && (
                      <p className="text-sm text-muted-foreground"><strong className="text-foreground">{isEn ? "Funding Type:" : "ফান্ডিং টাইপ:"}</strong> {opportunity.funding_type}</p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/30 text-sm text-amber-800 dark:text-amber-400">
                    {t("salaryNotSpecified")}
                  </div>
                )}
              </div>
            </Card>

            {/* Section 4: Documents needed */}
            <Card className="p-6 md:p-8 space-y-4 rounded-[26px] border border-border shadow-sm">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <span>{t("documentsNeeded")}</span>
              </h2>
              <div className="pl-7 space-y-4">
                {documentsNeeded.length > 0 ? (
                  <ul className="space-y-2.5 text-muted-foreground text-sm">
                    {documentsNeeded.map((doc, index) => (
                      <li key={`${doc}-${index}`} className="flex items-start gap-2.5">
                        <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-primary text-primary font-bold text-[10px]">✓</span>
                        <span>{doc}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-border text-sm text-muted-foreground">
                    {t("documentsNotSpecified")}
                  </div>
                )}
              </div>
            </Card>

            {/* Section 5: How to apply safely */}
            <Card className="p-6 md:p-8 space-y-6 rounded-[26px] border border-border shadow-sm">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                <span>{t("howToApplySafely")}</span>
              </h2>
              <div className="pl-7 space-y-6">
                {journeySteps.length > 0 ? (
                  <div className="space-y-4">
                    {journeySteps.map((step, index) => (
                      <div key={`${step}-${index}`} className="relative flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-sm">
                            {index + 1}
                          </span>
                          {index < journeySteps.length - 1 && (
                            <span className="mt-1 h-full w-0.5 bg-primary/20" />
                          )}
                        </div>
                        <p className="pt-1 text-sm text-muted-foreground leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {isEn
                      ? "Follow the link below to apply directly on the official source."
                      : "অফিশিয়াল লিংকের মাধ্যমে সরাসরি আবেদন করতে নিচের বাটনে ক্লিক করুন।"}
                  </p>
                )}

                {/* Safety Warning Card */}
                <div className="flex items-start gap-3 rounded-2xl border border-rose-200/50 bg-rose-50/50 dark:bg-rose-950/15 p-4">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                  <div>
                    <p className="font-bold text-rose-950 dark:text-rose-400 text-sm">
                      {isEn ? "Safety Warning" : "নিরাপত্তা সতর্কতা"}
                    </p>
                    <p className="mt-1.5 text-xs text-rose-900/80 dark:text-rose-300 leading-relaxed font-medium">
                      {t("safetyWarningText")}
                    </p>
                  </div>
                </div>

                <div className="border-t border-border pt-4 flex flex-wrap items-center justify-between gap-4">
                  {applyHref ? (
                    <a
                      href={applyHref}
                      target="_blank"
                      rel="noreferrer"
                      className="touch-target inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
                    >
                      <span>{isEn ? "Official Apply Link" : "অফিশিয়াল আবেদনের লিংক"}</span>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground font-semibold bg-slate-100 px-3 py-2 rounded-lg">{t("applyLinkUnavailable")}</span>
                  )}
                  
                  <a
                    href={opportunity.source_page_url || opportunity.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <span>{isEn ? "View Original Source Page" : "মূল সোর্স পেজ দেখুন"}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </Card>

            {/* Expandable Accordion: Official Source Details */}
            <details className="group rounded-[26px] border border-border bg-card p-6 shadow-sm">
              <summary className="flex cursor-pointer items-center justify-between font-bold text-lg text-foreground list-none focus:outline-none">
                <span>{t("officialSourceDetails")}</span>
                <span className="transition-transform duration-200 group-open:rotate-180">
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                </span>
              </summary>
              <div className="mt-6 space-y-6 border-t border-border pt-6">
                <SourceJobDetails sections={richSections} isEn={isEn} />
                <DetailAccordion
                  title={isEn ? "Requirements (Raw)" : "যা যা লাগবে (বিস্তারিত)"}
                  content={requirementItems}
                  defaultOpen={richSections.length === 0}
                />
                <DetailAccordion
                  title={isEn ? "Salary and Support (Raw)" : "বেতন ও সহায়তা (বিস্তারিত)"}
                  content={[
                    salaryText,
                    opportunity.salary_min != null
                      ? `${opportunity.salary_min}${opportunity.salary_max ? ` - ${opportunity.salary_max}` : ""} ${opportunity.salary_currency ?? ""}`.trim()
                      : null,
                    opportunity.funding_type,
                  ].filter(Boolean) as string[]}
                />
                <DetailAccordion
                  title={isEn ? "Documents (Raw)" : "নথিপত্র (বিস্তারিত)"}
                  content={documentDetails}
                />
                <DetailAccordion
                  title={isEn ? "Application Process (Raw)" : "আবেদন প্রক্রিয়া (বিস্তারিত)"}
                  content={processDetails}
                />

                {opportunity.document_url && (
                  <Card className="p-4 border border-border">
                    <h3 className="text-base font-bold text-foreground">
                      {isEn ? "Official Circular" : "মূল সার্কুলার"}
                    </h3>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-900/20">
                          <FileText className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {isEn ? "Download circular document" : "মূল সার্কুলার নথি ডাউনলোড করুন"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{opportunity.document_url}</p>
                        </div>
                      </div>
                      <a
                        href={opportunity.document_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-foreground hover:border-primary hover:text-primary transition-colors shrink-0"
                      >
                        <FileText className="h-4 w-4" />
                        <span>{isEn ? "Open PDF" : "PDF খুলুন"}</span>
                      </a>
                    </div>
                  </Card>
                )}
              </div>
            </details>

            <Link
              href="/search"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary pt-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {isEn ? "Back to search" : "অনুসন্ধানে ফিরুন"}
            </Link>
          </div>

          {/* Desktop Right Sidebar */}
          <aside className="space-y-4">
            <Card className="p-5 border border-border space-y-4">
              <DetailActionButtons
                opportunityId={id}
                initialSaved={opportunity.is_saved}
                applyHref={applyHref}
                locale={locale}
                variant="sidebar"
              />
              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="text-xs font-semibold text-muted-foreground">
                  {isEn ? "Share Opportunity" : "সুযোগটি শেয়ার করুন"}
                </span>
                <ShareButton url={opportunityUrl} title={titleText} />
              </div>
              <div className="text-xs text-muted-foreground space-y-2.5 pt-2 border-t border-border">
                {opportunity.deadline && (
                  <div className="flex items-center justify-between gap-3">
                    <span>{isEn ? "Deadline:" : "শেষ তারিখ:"}</span>
                    <span className="font-bold text-foreground">{formatDate(opportunity.deadline, locale)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span>{isEn ? "Added:" : "যোগ করা হয়েছে:"}</span>
                  <span className="font-semibold text-foreground">{formatDateTime(opportunity.created_at, locale)}</span>
                </div>
              </div>
            </Card>

            {/* Voice Player */}
            {safeVoicePlaybackSections.length > 0 ? (
              <OpportunityVoicePlayer sections={safeVoicePlaybackSections} locale={locale} />
            ) : null}

            {/* Safety Reminder Card */}
            <div className="p-4 rounded-2xl border border-warning/30 bg-warning/5 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-500">
                <AlertTriangle className="h-4 w-4" />
                <span>{isEn ? "Safe Apply Reminder" : "নিরাপদ আবেদন অনুস্মারক"}</span>
              </div>
              <p className="text-muted-foreground leading-relaxed font-medium">
                {isEn 
                  ? "Sudokkho always recommends verifying the official details and never paying money to unverified agents."
                  : "সুদক্ষ সবসময় অফিসিয়াল তথ্য যাচাই করার এবং কোনো যাচাই না করা এজেন্টকে টাকা না দেওয়ার পরামর্শ দেয়।"}
              </p>
            </div>

            {/* Similar Opportunities */}
            {similar.items.length > 0 && (
              <section className="space-y-3 pt-2">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                  {isEn ? "Similar Opportunities" : "একই ধরনের সুযোগ"}
                </h3>
                <div className="space-y-3">
                  {similar.items.slice(0, 2).map((item) => (
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
