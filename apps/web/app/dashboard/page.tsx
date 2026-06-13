import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { Route } from "next";

import { DashboardNav } from "@/components/dashboard-nav";
import { DashboardOpportunityMiniCard } from "@/components/dashboard-opportunity-mini-card";
import { Card } from "@/components/ui/card";
import { fetchBackendJsonWithAuth, requireCurrentUser } from "@/lib/server-auth-fetch";
import { getLocale, getT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type {
  AlertRulePage,
  OpportunityCard as OppCard,
  RecommendationResponse,
  AuthUser,
} from "@/lib/types";

async function GreetingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-12 animate-pulse" aria-hidden="true">
      <div className="md:col-span-8 rounded-2xl border border-border bg-card p-5 h-44" />
      <div className="md:col-span-4 rounded-2xl border border-border bg-card p-5 h-44" />
    </div>
  );
}

async function RecommendationsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden="true">
      <div className="h-6 w-32 rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 h-40" />
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 h-18" />
          <div className="rounded-2xl border border-border bg-card p-4 h-18" />
        </div>
      </div>
    </div>
  );
}

async function DashboardSummaryPanel({
  locale,
  user,
  recommendationsPromise,
}: {
  locale: "bn" | "en";
  user: AuthUser;
  recommendationsPromise: Promise<RecommendationResponse | null>;
}) {
  const recommendations = await recommendationsPromise;
  const recItems = recommendations?.items ?? [];
  const t = await getT("dashboard");
  const isEn = locale === "en";

  const urgentItemsCount = recItems.filter((item) => {
    if (!item.deadline) return false;
    const days = Math.ceil(
      (new Date(`${item.deadline}T00:00:00Z`).getTime() - Date.now()) / 86400000
    );
    return days >= 0 && days <= 7;
  }).length;

  const showUrgent = urgentItemsCount > 0;
  const showRecs = recItems.length > 0;

  // Resolve Primary CTA
  let ctaText = t("searchCta");
  let ctaHref = "/search";

  if (showUrgent) {
    ctaText = isEn ? "View urgent" : "জরুরি সুযোগ দেখুন";
    ctaHref = "#urgent-deadlines";
  } else if (showRecs) {
    ctaText = isEn ? "View best matches" : "সেরা সুযোগ দেখুন";
    ctaHref = "#top-recommendations";
  } else if (!user.onboarding_complete || recItems.length === 0) {
    ctaText = isEn ? "Update profile" : "প্রোফাইল আপডেট করুন";
    ctaHref = "/onboarding";
  }

  const firstName = user.full_name.split(" ")[0] || user.full_name;

  return (
    <div className="grid gap-4 md:grid-cols-12">
      {/* Left 8 columns: summary panel card */}
      <div className="md:col-span-8 rounded-2xl border border-slate-150 dark:border-slate-800 bg-gradient-to-r from-primary/5 via-primary/[0.02] to-transparent p-5 sm:p-6 shadow-sm flex flex-col justify-between">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-wider block mb-1">
            {isEn
              ? `Assalamu Alaikum, ${firstName}! 👋`
              : `আস্সালামুয়ালাইকুম, ${firstName} ভাই/আপা! 👋`}
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-850 dark:text-slate-100 flex items-center gap-2">
            <span>📅</span> {t("actionHeading")}
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-350 leading-relaxed max-w-xl font-medium">
            {t("actionHelperText")}
          </p>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
          <Link
            href={ctaHref as Route}
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90 shrink-0"
          >
            {ctaText}
          </Link>

          {/* Trust chips */}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] sm:text-xs font-bold text-slate-655 dark:text-slate-350 shadow-sm border border-slate-150/40 dark:border-slate-800/40">
              ✔️ {isEn ? "Trusted source" : "বিশ্বস্ত উৎস"}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] sm:text-xs font-bold text-slate-655 dark:text-slate-350 shadow-sm border border-slate-150/40 dark:border-slate-800/40">
              🇧🇩 {isEn ? "Apply from BD" : "বাংলাদেশ থেকে আবেদন"}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] sm:text-xs font-bold text-slate-655 dark:text-slate-350 shadow-sm border border-slate-150/40 dark:border-slate-800/40">
              🤖 {isEn ? "Sudokkho AI Help" : "সুদক্ষ AI সহায়তা"}
            </span>
          </div>
        </div>
      </div>

      {/* Right 4 columns: Compact AI helper card */}
      <div className="md:col-span-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-sm sm:text-base font-bold text-slate-850 dark:text-slate-100 leading-snug">
              {t("aiTitle")}
            </h3>
          </div>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            {t("aiSubtitle")}
          </p>
        </div>
        <div className="mt-4">
          <Link
            href="/copilot"
            className="inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-95"
          >
            <span>{t("aiCta")}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

async function StatsInsightChips({
  locale,
  savedPromise,
  alertPromise,
  recommendationsPromise,
}: {
  locale: "bn" | "en";
  savedPromise: Promise<OppCard[] | null>;
  alertPromise: Promise<AlertRulePage | null>;
  recommendationsPromise: Promise<RecommendationResponse | null>;
}) {
  const [savedItems, alertData, recommendations] = await Promise.all([
    savedPromise,
    alertPromise,
    recommendationsPromise,
  ]);

  const saved = savedItems ?? [];
  const alerts = alertData?.items ?? [];
  const recItems = recommendations?.items ?? [];
  const activeAlerts = alerts.filter((item) => item.is_active).length;
  const urgentItems = recItems.filter((item) => {
    if (!item.deadline) return false;
    const days = Math.ceil(
      (new Date(`${item.deadline}T00:00:00Z`).getTime() - Date.now()) / 86400000
    );
    return days >= 0 && days <= 7;
  }).length;
  const canApplyFromBd = recItems.filter((item) => item.can_apply_from_bd).length;
  const isEn = locale === "en";

  const chips = [
    { value: saved.length, label: isEn ? "Saved" : "সংরক্ষিত", icon: "💾" },
    { value: activeAlerts, label: isEn ? "Active alerts" : "সক্রিয় সতর্কতা", icon: "🔔" },
    { value: urgentItems, label: isEn ? "Closing soon" : "শেষ তারিখ আসছে", icon: "⌛" },
    { value: canApplyFromBd, label: isEn ? "Apply from BD" : "বাংলাদেশ থেকে আবেদন", icon: "🇧🇩" },
  ];

  return (
    <div className="flex flex-wrap gap-2 py-1 overflow-x-auto scrollbar-none max-w-full">
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900/60 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-350 shadow-sm shrink-0"
        >
          <span aria-hidden="true">{chip.icon}</span>
          <span className="text-primary">{chip.value}</span>
          <span className="text-slate-400 dark:text-slate-500 font-medium">{chip.label}</span>
        </span>
      ))}
    </div>
  );
}

async function RecommendationsSection({
  locale,
  recommendationsPromise,
}: {
  locale: "bn" | "en";
  recommendationsPromise: Promise<RecommendationResponse | null>;
}) {
  const recommendations = await recommendationsPromise;
  const recItems = recommendations?.items ?? [];
  const t = await getT("dashboard");
  const isEn = locale === "en";
  const displayItems = recItems.slice(0, 3);

  return (
    <section id="top-recommendations" className="space-y-4" aria-labelledby="dashboard-recommendations">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 id="dashboard-recommendations" className="text-lg font-bold text-foreground flex items-center gap-2">
            <span>🌟</span>
            {t("topRecsTitle")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("topRecsSubtitle")}
          </p>
        </div>
        <Link
          href="/search"
          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline shrink-0 min-h-[38px]"
          aria-label={isEn ? "Browse all opportunities" : "সব সুযোগ দেখুন"}
        >
          <span>{isEn ? "View all opportunities" : "সব সুযোগ দেখুন"}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {displayItems.length === 0 ? (
        <Card className="text-center p-6 border-slate-150 dark:border-slate-800 bg-white dark:bg-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
            🌱
          </div>
          <h3 className="mt-4 text-base font-bold text-foreground">
            {isEn ? "No recommendations yet" : "এখনো সুপারিশ করার মতো সুযোগ নেই"}
          </h3>
          <p className="mt-2 text-xs text-muted-foreground">
            {isEn
              ? "Complete your profile or change your sector to see better matches."
              : "আপনার প্রোফাইল আরও পূর্ণ করুন বা সেক্টর পরিবর্তন করুন।"}
          </p>
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm min-h-[38px]"
              aria-label={isEn ? "Update profile" : "প্রোফাইল আপডেট করুন"}
            >
              {isEn ? "Update profile" : "প্রোফাইল আপডেট করুন"}
            </Link>
            <Link
              href="/search"
              className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground min-h-[38px]"
              aria-label={isEn ? "View all opportunities" : "সব সুযোগ দেখুন"}
            >
              {isEn ? "View all opportunities" : "সব সুযোগ দেখুন"}
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Spotlight card: best match taking left half */}
          <div className="sm:col-span-2 lg:col-span-1">
            <DashboardOpportunityMiniCard item={displayItems[0]} highlighted={true} />
          </div>
          {/* Column stack of the other two matches on the right half */}
          <div className="flex flex-col gap-4">
            {displayItems.slice(1).map((item) => (
              <DashboardOpportunityMiniCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

async function UrgentDeadlinesSection({
  locale,
  recommendationsPromise,
}: {
  locale: "bn" | "en";
  recommendationsPromise: Promise<RecommendationResponse | null>;
}) {
  const recommendations = await recommendationsPromise;
  const recItems = recommendations?.items ?? [];
  const t = await getT("dashboard");

  const urgentItems = recItems
    .filter((item) => {
      if (!item.deadline) return false;
      const days = Math.ceil(
        (new Date(`${item.deadline}T00:00:00Z`).getTime() - Date.now()) / 86400000
      );
      return days >= 0 && days <= 7;
    })
    .slice(0, 3);

  return (
    <section id="urgent-deadlines" className="space-y-4" aria-labelledby="dashboard-urgent">
      <div>
        <h2 id="dashboard-urgent" className="text-lg font-bold text-foreground flex items-center gap-2">
          <span>⚡</span>
          {t("urgentTitle")}
        </h2>
      </div>

      {urgentItems.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-card p-5 text-center">
          <p className="text-xs text-muted-foreground font-medium">
            {t("urgentEmptyText")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {urgentItems.map((item) => (
            <DashboardOpportunityMiniCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

async function SavedItemsSection({
  locale,
  savedPromise,
}: {
  locale: "bn" | "en";
  savedPromise: Promise<OppCard[] | null>;
}) {
  const savedItems = await savedPromise;
  const saved = savedItems ?? [];
  const t = await getT("dashboard");
  const isEn = locale === "en";
  const displaySaved = saved.slice(0, 3);

  return (
    <section className="space-y-3" aria-labelledby="dashboard-saved">
      <div className="flex items-center justify-between gap-3">
        <h3 id="dashboard-saved" className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <span>💾</span>
          {t("savedTitle")}
        </h3>
        {saved.length > 0 && (
          <Link
            href="/saved"
            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline shrink-0 min-h-[38px]"
            aria-label={isEn ? "View all saved items" : "সংরক্ষিত সব দেখুন"}
          >
            <span>{isEn ? "View all" : "সব দেখুন"}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {saved.length === 0 ? (
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-card p-4 text-center space-y-3 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">
            {t("savedEmptyText")}
          </p>
          <div>
            <Link
              href="/search"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm min-h-[38px]"
            >
              {t("searchCta")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {displaySaved.map((item) => (
            <DashboardOpportunityMiniCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function DashboardPage() {
  const [user, locale] = await Promise.all([requireCurrentUser(), getLocale()]);
  const isEn = locale === "en";

  const savedPromise = fetchBackendJsonWithAuth<OppCard[]>("/api/v1/saved");
  const alertPromise = fetchBackendJsonWithAuth<AlertRulePage>("/api/v1/alerts");
  const recommendationsPromise = fetchBackendJsonWithAuth<RecommendationResponse>(
    "/api/v1/recommendations?page_size=6",
  );

  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {/* Navigation Tabs */}
        <DashboardNav
          items={[
            { label: isEn ? "Dashboard" : "ড্যাশবোর্ড", href: "/dashboard" },
            { label: isEn ? "Alerts" : "সতর্কতা", href: "/alerts" },
            { label: isEn ? "Sudokkho AI" : "সুদক্ষ AI", href: "/copilot" },
            ...(user.is_admin ? [{ label: "Admin", href: "/admin" as const }] : []),
          ]}
        />

        {/* Above-the-fold summary panel grid */}
        <Suspense fallback={<GreetingSkeleton />}>
          <DashboardSummaryPanel
            locale={locale}
            user={user as AuthUser}
            recommendationsPromise={recommendationsPromise}
          />
        </Suspense>

        {/* Insight Stats Chips bar */}
        <Suspense fallback={<div className="h-8 animate-pulse rounded bg-muted w-1/2" />}>
          <StatsInsightChips
            locale={locale}
            savedPromise={savedPromise}
            alertPromise={alertPromise}
            recommendationsPromise={recommendationsPromise}
          />
        </Suspense>

        {/* Main 12-column grid layout */}
        <div className="grid gap-6 md:grid-cols-12">
          {/* Left Column (8 cols): Top Matches + Urgent Deadlines */}
          <div className="md:col-span-8 space-y-6">
            <Suspense fallback={<RecommendationsSkeleton />}>
              <RecommendationsSection
                locale={locale}
                recommendationsPromise={recommendationsPromise}
              />
            </Suspense>

            <Suspense fallback={<RecommendationsSkeleton />}>
              <UrgentDeadlinesSection
                locale={locale}
                recommendationsPromise={recommendationsPromise}
              />
            </Suspense>
          </div>

          {/* Right Column (4 cols): Saved items preview + Quick access */}
          <div className="md:col-span-4 space-y-6">
            <Suspense fallback={<RecommendationsSkeleton />}>
              <SavedItemsSection
                locale={locale}
                savedPromise={savedPromise}
              />
            </Suspense>

            {/* Quick Access section */}
            <section className="space-y-3" aria-labelledby="dashboard-quick-access">
              <h3 id="dashboard-quick-access" className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {isEn ? "Quick links" : "দ্রুত যান"}
              </h3>
              <div className="grid gap-2.5">
                <Link href="/saved" className="rounded-xl border border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 transition-all hover:border-primary shadow-sm flex items-center min-h-[60px]">
                  <div className="flex items-center gap-3 w-full">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-bold">
                      💾
                    </div>
                    <div className="leading-tight">
                      <p className="text-sm font-bold text-slate-850 dark:text-slate-200">{isEn ? "Saved" : "সংরক্ষিত"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isEn ? "Saved items" : "সংরক্ষিত তালিকা"}
                      </p>
                    </div>
                  </div>
                </Link>

                <Link href="/alerts" className="rounded-xl border border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 transition-all hover:border-primary shadow-sm flex items-center min-h-[60px]">
                  <div className="flex items-center gap-3 w-full">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 font-bold">
                      🔔
                    </div>
                    <div className="leading-tight">
                      <p className="text-sm font-bold text-slate-850 dark:text-slate-200">{isEn ? "Alerts" : "সতর্কতা"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isEn ? "Alert rules" : "সতর্কতা নিয়ম"}
                      </p>
                    </div>
                  </div>
                </Link>

                <Link href="/search?sort=deadline" className="rounded-xl border border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 transition-all hover:border-primary shadow-sm flex items-center min-h-[60px]">
                  <div className="flex items-center gap-3 w-full">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 font-bold">
                      ⚡
                    </div>
                    <div className="leading-tight">
                      <p className="text-sm font-bold text-slate-850 dark:text-slate-200">{isEn ? "Urgent" : "জরুরি"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isEn ? "Closing soon" : "দ্রুত শেষ হবে"}
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
