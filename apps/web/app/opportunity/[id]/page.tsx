import Link from "next/link";
import {
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  GraduationCap,
  MapPin,
  ShieldCheck,
  Shield,
  AlertTriangle,
  Bookmark,
  Sparkles,
  ArrowLeft,
  Banknote,
  CheckCircle,
  XCircle,
} from "lucide-react";

import { OpportunityCard } from "@/components/opportunity-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getOpportunity, getSimilar } from "@/lib/api";
import { getLocale, getT } from "@/lib/i18n";
import { formatDate, formatDateTime, humanizeSlug } from "@/lib/utils";

interface OpportunityDetailProps {
  params: Promise<{ id: string }>;
}

function TrustTierBadge({ tier }: { tier: string }) {
  if (tier === "official_gov") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-green-600/30 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 dark:border-green-700/30 dark:bg-green-900/20 dark:text-green-400">
        <ShieldCheck className="h-3.5 w-3.5" />
        সরকারি উৎস
      </span>
    );
  }
  if (tier === "official_partner") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-600/30 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-700/30 dark:bg-blue-900/20 dark:text-blue-400">
        <Shield className="h-3.5 w-3.5" />
        অফিসিয়াল উৎস
      </span>
    );
  }
  return (
    <Badge variant="default">
      {humanizeSlug(tier, "bn")}
    </Badge>
  );
}

export default async function OpportunityDetailPage({ params }: OpportunityDetailProps) {
  const { id } = await params;
  const [opportunity, similar, locale] = await Promise.all([
    getOpportunity(id),
    getSimilar(id),
    getLocale(),
  ]);
  const isEn = locale === "en";
  const t = await getT("opportunity");

  const requirements = opportunity.requirements_json?.items ?? [];
  const benefits = opportunity.benefits_json?.items ?? [];
  const languages = opportunity.language_requirements_json?.items ?? [];

  const hasSalary = opportunity.salary_min != null || opportunity.funding_type;
  const hasDeadline = opportunity.deadline != null;
  const hasVisa = opportunity.visa_support != null;
  const hasLocation = opportunity.country != null || opportunity.city != null;
  const orgName = opportunity.employer ?? opportunity.organization;

  const recordTypeLabel: Record<string, string> = {
    job: "প্রবাস চাকরি",
    scholarship: "স্কলারশিপ",
    policy_update: "ভিসা নীতি",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-primary transition-colors">
            {isEn ? "Home" : "হোম"}
          </Link>
          <span>/</span>
          <Link href="/search" className="hover:text-primary transition-colors">
            {isEn ? "Search" : "অনুসন্ধান"}
          </Link>
          <span>/</span>
          <span className="text-foreground line-clamp-1">{opportunity.title}</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main content */}
          <div className="space-y-5">
            {/* Header card */}
            <Card>
              {/* Type + trust */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-primary">
                  {recordTypeLabel[opportunity.record_type] ?? opportunity.record_type}
                </span>
                <span className="text-muted-foreground">·</span>
                <TrustTierBadge tier={opportunity.trust_tier ?? ""} />
                {!opportunity.is_active && (
                  <Badge variant="danger">
                    {isEn ? "Expired" : "মেয়াদ শেষ"}
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl font-bold leading-snug text-foreground">
                {opportunity.title}
              </h1>

              {orgName && (
                <p className="mt-1.5 text-base text-muted-foreground">{orgName}</p>
              )}

              {/* Meta row */}
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground border-t border-border pt-4">
                {hasLocation && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                    {[opportunity.city, opportunity.country].filter(Boolean).join(", ")}
                  </span>
                )}
                {hasDeadline && (
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Calendar className="h-4 w-4 shrink-0 text-primary" />
                    {isEn ? "Deadline" : "আবেদনের শেষ তারিখ"}:{" "}
                    {formatDate(opportunity.deadline, locale)}
                  </span>
                )}
                {opportunity.sector && (
                  <span className="flex items-center gap-1.5">
                    <Globe className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                    {opportunity.sector}
                  </span>
                )}
                {opportunity.degree_level && (
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                    {opportunity.degree_level}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                  {isEn ? "Added" : "যোগ করা হয়েছে"}:{" "}
                  {formatDateTime(opportunity.created_at, locale)}
                </span>
              </div>
            </Card>

            {/* Summary */}
            {opportunity.summary && (
              <Card>
                <h2 className="mb-3 font-bold text-foreground section-underline">
                  {isEn ? "Summary" : "সারসংক্ষেপ"}
                </h2>
                <p className="text-sm text-foreground leading-relaxed">{opportunity.summary}</p>
              </Card>
            )}

            {/* Salary / Funding */}
            {hasSalary && (
              <Card>
                <h2 className="mb-3 font-bold text-foreground section-underline">
                  {isEn ? "Compensation" : "বেতন ও সুবিধা"}
                </h2>
                <div className="flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-success" />
                  <span className="text-lg font-bold text-foreground">
                    {opportunity.salary_min
                      ? `${opportunity.salary_min}${opportunity.salary_max ? `–${opportunity.salary_max}` : ""} ${opportunity.salary_currency ?? ""}`
                      : opportunity.funding_type}
                  </span>
                </div>
              </Card>
            )}

            {/* Visa support */}
            {hasVisa && (
              <div
                className={`flex items-center gap-2 rounded-lg border p-4 ${
                  opportunity.visa_support
                    ? "border-success/30 bg-success/10"
                    : "border-border bg-muted/40"
                }`}
              >
                {opportunity.visa_support ? (
                  <>
                    <CheckCircle className="h-5 w-5 shrink-0 text-success" />
                    <span className="text-sm font-semibold text-success">
                      {isEn ? "Visa support provided" : "ভিসা সহায়তা প্রদান করা হয়"}
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {isEn ? "No visa support mentioned" : "ভিসা সহায়তার উল্লেখ নেই"}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Requirements */}
            {requirements.length > 0 && (
              <Card>
                <h2 className="mb-3 font-bold text-foreground section-underline">
                  {isEn ? "Requirements" : "যোগ্যতা"}
                </h2>
                <ul className="space-y-2">
                  {requirements.map((item: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Benefits */}
            {benefits.length > 0 && (
              <Card>
                <h2 className="mb-3 font-bold text-foreground section-underline">
                  {isEn ? "Benefits" : "সুবিধাসমূহ"}
                </h2>
                <ul className="space-y-2">
                  {benefits.map((item: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Language requirements */}
            {languages.length > 0 && (
              <Card>
                <h2 className="mb-3 font-bold text-foreground section-underline">
                  {isEn ? "Language Requirements" : "ভাষার প্রয়োজনীয়তা"}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {languages.map((lang: string, idx: number) => (
                    <Badge key={idx} variant="outline">
                      {lang}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}

            {/* Safety warning */}
            <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isEn ? "Important notice" : "গুরুত্বপূর্ণ সতর্কতা"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {isEn
                    ? "Verify this opportunity through the official source before making any payment or sharing personal documents. We compile information only — we are not the employer."
                    : "কোনো অর্থ লেনদেন বা ব্যক্তিগত নথি শেয়ারের আগে সরকারি বা অফিসিয়াল উৎস থেকে এই সুযোগ যাচাই করুন। আমরা তথ্য সংকলন করি — সরাসরি নিয়োগকর্তা নই।"}
                </p>
              </div>
            </div>

            {/* PDF circular download */}
            {opportunity.document_url && (
              <Card>
                <h2 className="mb-3 font-bold text-foreground section-underline">
                  {isEn ? "Official Circular (PDF)" : "মূল সার্কুলার (PDF)"}
                </h2>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/20">
                    <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {isEn ? "Download original PDF document" : "মূল PDF ডকুমেন্ট ডাউনলোড করুন"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {opportunity.document_url}
                    </p>
                  </div>
                  <a
                    href={opportunity.document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {isEn ? "Open" : "খুলুন"}
                  </a>
                </div>
              </Card>
            )}

            {/* Source */}
            <Card>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                {isEn ? "Original source" : "মূল উৎস"}
              </h2>
              <a
                href={opportunity.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {opportunity.source_url}
              </a>
            </Card>

            {/* Back */}
            <Link
              href="/search"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {isEn ? "Back to search" : "অনুসন্ধানে ফিরুন"}
            </Link>
          </div>

          {/* Right sidebar */}
          <aside className="space-y-4">
            {/* CTA card */}
            <Card>
              {/* Apply */}
              {opportunity.application_url ? (
                <a
                  href={opportunity.application_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
                >
                  <ExternalLink className="h-4 w-4" />
                  {isEn ? "Apply now" : "আবেদন করুন"}
                </a>
              ) : (
                <a
                  href={opportunity.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
                >
                  <ExternalLink className="h-4 w-4" />
                  {isEn ? "View source" : "উৎস দেখুন"}
                </a>
              )}

              <Link
                href="/copilot"
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                {isEn ? "Ask AI about this" : "AI-তে জিজ্ঞেস করুন"}
              </Link>

              {/* Key info */}
              <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                {hasDeadline && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {isEn ? "Deadline" : "শেষ তারিখ"}
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatDate(opportunity.deadline, locale)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {isEn ? "Trust tier" : "বিশ্বাসযোগ্যতা"}
                  </span>
                  <span className="font-semibold text-foreground">
                    {humanizeSlug(opportunity.trust_tier ?? "", locale)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {isEn ? "Confidence" : "AI আস্থা স্কোর"}
                  </span>
                  <span className="font-semibold text-foreground">
                    {Math.round(opportunity.extraction_confidence * 100)}%
                  </span>
                </div>
              </div>
            </Card>

            {/* Similar */}
            {similar.items && similar.items.length > 0 && (
              <div>
                <h3 className="mb-3 font-bold text-foreground section-underline">
                  {isEn ? "Similar opportunities" : "একই ধরনের সুযোগ"}
                </h3>
                <div className="space-y-3">
                  {similar.items.slice(0, 3).map((item) => (
                    <OpportunityCard key={item.id} item={item} variant="compact" />
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
