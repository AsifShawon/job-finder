import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Calendar,
  CheckCircle,
  ExternalLink,
  FileText,
  MapPin,
  ShieldCheck,
} from "lucide-react";

import { BilingualSummary } from "@/components/bilingual-summary";
import { OpportunityCard } from "@/components/opportunity-card";
import { ShareButton } from "@/components/share-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getOpportunity, getSimilar } from "@/lib/api";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatDateTime, humanizeSlug } from "@/lib/utils";

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
  const requirementItems = opportunity.requirements_json?.items ?? [];
  const documentDetails = [
    opportunity.required_documents,
    opportunity.language_requirement,
    opportunity.education_requirement,
  ].filter(Boolean) as string[];
  const processDetails = [
    opportunity.application_process,
    opportunity.visa_or_work_permit_info,
    opportunity.experience_requirement,
  ].filter(Boolean) as string[];

  return (
    <main className="bg-background">
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
          <span className="line-clamp-1 text-foreground">
            {isEn ? opportunity.title : opportunity.title_bn || opportunity.title}
          </span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {opportunity.opportunity_type ? humanizeSlug(opportunity.opportunity_type, locale) : (isEn ? "Opportunity" : "সুযোগ")}
                </Badge>
                <TrustTierBadge tier={opportunity.trust_tier} locale={locale} />
                {!opportunity.is_active && (
                  <Badge variant="danger">{isEn ? "Expired" : "মেয়াদ শেষ"}</Badge>
                )}
              </div>

              <h1 className="mt-4 text-3xl font-bold leading-tight text-foreground">
                {isEn ? opportunity.title : opportunity.title_bn || opportunity.title}
              </h1>
              {opportunity.title_bn && opportunity.title && opportunity.title_bn !== opportunity.title && (
                <p className="mt-2 text-muted-foreground">{isEn ? opportunity.title_bn : opportunity.title}</p>
              )}

              {organization && (
                <p className="mt-2 font-medium text-muted-foreground">{organization}</p>
              )}

              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-sm text-muted-foreground">
                {(opportunity.city || opportunity.country) && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {[opportunity.city, opportunity.country].filter(Boolean).join(", ")}
                  </span>
                )}
                {opportunity.deadline && (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                    <Calendar className="h-4 w-4 text-primary" />
                    {formatDate(opportunity.deadline, locale)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-success" />
                  {opportunity.can_apply_from_bd
                    ? (isEn ? "Apply from Bangladesh" : "বাংলাদেশ থেকে আবেদনযোগ্য")
                    : (isEn ? "Check eligibility first" : "আবেদনযোগ্যতা দেখে নিন")}
                </span>
              </div>
            </Card>

            <Card>
              <h2 className="section-underline text-xl font-bold text-foreground">
                {isEn ? "What You Should Know First" : "আপনার জন্য কী জানা দরকার"}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-muted/60 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    {isEn ? "Eligibility" : "আবেদনযোগ্যতা"}
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    {opportunity.can_apply_from_bd
                      ? (isEn ? "You can apply directly from Bangladesh." : "বাংলাদেশ থেকে সরাসরি আবেদন করা যাবে।")
                      : (isEn ? "Check the official source before applying." : "আবেদনের আগে সরকারি বা মূল উৎস দেখে নিন।")}
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/60 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    {isEn ? "Trust Level" : "বিশ্বাসযোগ্যতা"}
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    {opportunity.trust_tier === "official_gov"
                      ? (isEn ? "This listing comes from an official government source." : "এই তালিকাটি সরকারি উৎসভিত্তিক।")
                      : (isEn ? "Review the source link and documents before proceeding." : "পরবর্তী ধাপে যাওয়ার আগে উৎস লিংক ও নথি দেখে নিন।")}
                  </p>
                </div>
              </div>
            </Card>

            {(opportunity.summary_bn || opportunity.summary_en || opportunity.summary) && (
              <Card>
                <h2 className="section-underline text-xl font-bold text-foreground">
                  {isEn ? "Summary" : "সারসংক্ষেপ"}
                </h2>
                <div className="mt-4">
                  <BilingualSummary
                    summaryBn={opportunity.summary_bn || opportunity.summary || null}
                    summaryEn={opportunity.summary_en || opportunity.summary || null}
                  />
                </div>
              </Card>
            )}

            <section className="space-y-3" aria-label={isEn ? "Opportunity details" : "সুযোগের বিস্তারিত"}>
              <DetailAccordion
                title={isEn ? "Requirements" : "যা যা লাগবে"}
                content={requirementItems}
                defaultOpen
              />
              {opportunity.journey_steps.length > 0 && (
                <Card>
                  <h2 className="section-underline text-xl font-bold text-foreground">
                    {isEn ? "How to Apply" : "কীভাবে আবেদন করবেন"}
                  </h2>
                  <ol className="mt-4 space-y-2 text-muted-foreground">
                    {opportunity.journey_steps.map((step, index) => (
                      <li key={`${step}-${index}`}>{index + 1}. {step}</li>
                    ))}
                  </ol>
                </Card>
              )}
              <DetailAccordion
                title={isEn ? "Salary and Support" : "বেতন ও সহায়তা"}
                content={[
                  opportunity.salary_text,
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                <ExternalLink className="h-4 w-4" />
                <span>{isEn ? "Apply Now" : "এখনই আবেদন করুন"}</span>
              </a>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {isEn ? "Share" : "শেয়ার"}
                </span>
                <ShareButton url={opportunityUrl} title={opportunity.title} />
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
                {(opportunity.salary_min != null || opportunity.salary_text) && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{isEn ? "Salary" : "বেতন"}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                      <Banknote className="h-4 w-4 text-success" />
                      {opportunity.salary_text ?? `${opportunity.salary_min} ${opportunity.salary_currency ?? ""}`}
                    </span>
                  </div>
                )}
              </div>
            </Card>

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

      <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-border bg-card p-3 md:hidden">
        <a
          href={applyHref}
          target="_blank"
          rel="noreferrer"
          className="block w-full rounded-xl bg-primary py-3 text-center text-sm font-bold text-white"
        >
          {isEn ? "Apply Now" : "এখনই আবেদন করুন"} ↗
        </a>
      </div>
    </main>
  );
}
