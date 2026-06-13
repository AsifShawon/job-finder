import Link from "next/link";
import { Suspense } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Bookmark,
  Sparkles,
} from "lucide-react";
import type { Route } from "next";

import { DashboardNav } from "@/components/dashboard-nav";
import { OpportunityCard } from "@/components/opportunity-card";
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

async function GreetingSection({
  user,
  locale,
}: {
  user: AuthUser;
  locale: "bn" | "en";
}) {
  const t = await getT("dashboard");
  const isEn = locale === "en";
  const firstName = user.full_name.split(" ")[0] || user.full_name;

  return (
    <section className="space-y-2" aria-label={isEn ? "Dashboard heading" : "ড্যাশবোর্ড শিরোনাম"}>
      <p className="text-xs sm:text-sm font-bold text-primary uppercase tracking-wider">
        {isEn
          ? `Assalamu Alaikum, ${firstName}! 👋`
          : `আস্সালামুয়ালাইকুম, ${firstName} ভাই/আপা! 👋`}
      </p>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground leading-tight">
        {t("actionHeading")}
      </h1>
      <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
        {t("actionHelperText")}
      </p>
    </section>
  );
}

function GreetingSkeleton() {
  return (
    <section className="space-y-3 animate-pulse" aria-hidden="true">
      <div className="h-4 w-40 rounded bg-muted" />
      <div className="h-8 w-64 rounded-xl bg-muted" />
      <div className="h-4 w-72 rounded bg-muted" />
    </section>
  );
}

async function TodayNextSteps({
  locale,
  user,
  recommendationsPromise,
  savedPromise,
}: {
  locale: "bn" | "en";
  user: AuthUser;
  recommendationsPromise: Promise<RecommendationResponse | null>;
  savedPromise: Promise<OppCard[] | null>;
}) {
  const [recommendations, savedItems] = await Promise.all([
    recommendationsPromise,
    savedPromise,
  ]);
  const t = await getT("dashboard");

  const recItems = recommendations?.items ?? [];
  const saved = savedItems ?? [];
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
  const showSaved = saved.length > 0;
  const showProfileIncomplete = !user.onboarding_complete || recItems.length === 0;

  const actions: Array<{
    text: string;
    cta: string;
    href: string;
    icon: string;
    variant: "urgent" | "default" | "saved" | "ai" | "profile";
  }> = [];

  if (showUrgent) {
    actions.push({
      text: t("actions.urgent"),
      cta: t("actions.urgentCta"),
      href: "#urgent-deadlines",
      icon: "⚡",
      variant: "urgent",
    });
  }

  if (showRecs) {
    actions.push({
      text: t("actions.recs"),
      cta: t("actions.recsCta"),
      href: "#top-recommendations",
      icon: "🌟",
      variant: "default",
    });
  }

  if (showSaved) {
    actions.push({
      text: t("actions.saved"),
      cta: t("actions.savedCta"),
      href: "/saved",
      icon: "💾",
      variant: "saved",
    });
  }

  // Always include Sudokkho AI help
  actions.push({
    text: t("actions.ai"),
    cta: t("actions.aiCta"),
    href: "/copilot",
    icon: "🤖",
    variant: "ai",
  });

  if (showProfileIncomplete) {
    actions.push({
      text: t("actions.profile"),
      cta: t("actions.profileCta"),
      href: "/onboarding",
      icon: "✏️",
      variant: "profile",
    });
  }

  return (
    <section className="rounded-2xl border border-slate-150 dark:border-slate-800 bg-white dark:bg-card p-5 shadow-sm space-y-4" aria-label={isEn ? "Action Checklist" : "করণীয় তালিকা"}>
      <div className="grid gap-3">
        {actions.map((act, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border transition-all",
              act.variant === "urgent"
                ? "bg-red-50/55 border-red-150 dark:bg-red-950/10 dark:border-red-900/20"
                : act.variant === "ai"
                ? "bg-primary/5 border-primary/10 dark:bg-primary/5 dark:border-primary/20"
                : "bg-slate-50/50 border-slate-100 dark:bg-slate-900/20 dark:border-slate-800/60"
            )}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5" aria-hidden="true">{act.icon}</span>
              <p className="text-sm font-bold text-slate-850 dark:text-slate-200 leading-snug">
                {act.text}
              </p>
            </div>
            <Link
              href={act.href as Route}
              className={cn(
                "inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-xs font-bold transition-all shadow-sm shrink-0 border select-none min-h-[44px]",
                act.variant === "urgent"
                  ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
                  : act.variant === "ai"
                  ? "bg-primary text-white border-primary hover:bg-primary/95"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-350 dark:border-slate-700"
              )}
            >
              {act.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

function NextStepsSkeleton() {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-3 animate-pulse" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={`step-sk-${index}`} className="flex flex-col sm:flex-row justify-between gap-4 p-4 rounded-xl border border-border bg-muted/20">
          <div className="flex items-start gap-3 w-3/4">
            <div className="h-6 w-6 rounded-full bg-muted shrink-0" />
            <div className="h-4 w-full rounded bg-muted" />
          </div>
          <div className="h-10 w-28 rounded-xl bg-muted shrink-0" />
        </div>
      ))}
    </section>
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 id="dashboard-recommendations" className="text-xl font-bold text-foreground flex items-center gap-2">
            <span>🌟</span>
            {t("topRecsTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("topRecsSubtitle")}
          </p>
        </div>
        <Link
          href="/search"
          className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline shrink-0 min-h-[44px]"
          aria-label={isEn ? "Browse all opportunities" : "সব সুযোগ দেখুন"}
        >
          <span>{isEn ? "View all opportunities" : "সব সুযোগ দেখুন"}</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {displayItems.length === 0 ? (
        <Card className="text-center p-6 border-slate-150 dark:border-slate-800 bg-white dark:bg-card">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl">
            🌱
          </div>
          <h3 className="mt-4 text-lg font-bold text-foreground">
            {isEn ? "No recommendations yet" : "এখনো সুপারিশ করার মতো সুযোগ নেই"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {isEn
              ? "Complete your profile or change your sector to see better matches."
              : "আপনার প্রোফাইল আরও পূর্ণ করুন বা সেক্টর পরিবর্তন করুন।"}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm min-h-[44px]"
              aria-label={isEn ? "Update profile" : "প্রোফাইল আপডেট করুন"}
            >
              {isEn ? "Update profile" : "প্রোফাইল আপডেট করুন"}
            </Link>
            <Link
              href="/search"
              className="inline-flex items-center justify-center rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-foreground min-h-[44px]"
              aria-label={isEn ? "View all opportunities" : "সব সুযোগ দেখুন"}
            >
              {isEn ? "View all opportunities" : "সব সুযোগ দেখুন"}
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {displayItems.map((item) => (
            <OpportunityCard key={item.id} item={item} showMatchBanner />
          ))}
        </div>
      )}
    </section>
  );
}

function RecommendationsSkeleton() {
  return (
    <section className="space-y-4 animate-pulse" aria-hidden="true">
      <div className="h-8 w-48 rounded bg-muted" />
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={`rec-sk-${index}`} className="border border-border bg-card p-5 rounded-2xl h-36" />
      ))}
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
  const isEn = locale === "en";

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
        <h2 id="dashboard-urgent" className="text-xl font-bold text-foreground flex items-center gap-2">
          <span>⚡</span>
          {t("urgentTitle")}
        </h2>
      </div>

      {urgentItems.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground font-medium">
            {t("urgentEmptyText")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {urgentItems.map((item) => (
            <OpportunityCard key={item.id} item={item} />
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
    <section className="space-y-4" aria-labelledby="dashboard-saved">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 id="dashboard-saved" className="text-xl font-bold text-foreground flex items-center gap-2">
            <span>💾</span>
            {t("savedTitle")}
          </h2>
        </div>
        {saved.length > 0 && (
          <Link
            href="/saved"
            className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline shrink-0 min-h-[44px]"
            aria-label={isEn ? "View all saved items" : "সংরক্ষিত সব দেখুন"}
          >
            <span>{isEn ? "View all saved" : "সংরক্ষিত সব দেখুন"}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {saved.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-card p-6 text-center space-y-4">
          <p className="text-sm text-muted-foreground font-medium">
            {t("savedEmptyText")}
          </p>
          <div>
            <Link
              href="/search"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm min-h-[44px]"
            >
              {t("searchCta")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {displaySaved.map((item) => (
            <OpportunityCard key={item.id} item={item} variant="compact" />
          ))}
        </div>
      )}
    </section>
  );
}

async function SudokkhoAiSection({ locale }: { locale: "bn" | "en" }) {
  const t = await getT("dashboard");
  const isEn = locale === "en";
  return (
    <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-sm" aria-label={isEn ? "Sudokkho AI Help" : "সুদক্ষ AI সাহায্য"}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">
              {t("aiTitle")}
            </h2>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
            {t("aiSubtitle")}
          </p>
        </div>
        <Link
          href="/copilot"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-95 shadow-md shrink-0 min-h-[44px]"
        >
          <span>{t("aiCta")}</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

async function SecondaryStatsSummary({
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
  const t = await getT("dashboard");
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

  const stats = [
    { value: saved.length, label: isEn ? "Saved" : "সংরক্ষিত" },
    { value: activeAlerts, label: isEn ? "Active alerts" : "সক্রিয় সতর্কতা" },
    { value: urgentItems, label: isEn ? "Closing soon" : "শেষ তারিখ আসছে" },
    { value: canApplyFromBd, label: isEn ? "Apply from Bangladesh" : "বাংলাদেশ থেকে আবেদন" },
  ];

  return (
    <section className="space-y-3" aria-label={isEn ? "Activity summary stats" : "কার্যক্রম সারসংক্ষেপ"}>
      <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
        {t("activitySummary")}
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ value, label }) => (
          <div
            key={label}
            className="flex flex-col justify-center rounded-xl border border-slate-100 bg-slate-50/30 dark:border-slate-800 dark:bg-slate-900/10 px-4 py-2.5 min-h-[64px]"
          >
            <p className="text-lg font-extrabold text-foreground leading-none">{value}</p>
            <p className="mt-1.5 text-[11px] font-bold text-muted-foreground leading-tight">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SecondaryStatsSkeleton() {
  return (
    <section className="space-y-3 animate-pulse" aria-hidden="true">
      <div className="h-4 w-32 rounded bg-muted" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`stat-sk-${index}`} className="border border-slate-100 bg-slate-50/30 p-4 rounded-xl h-16" />
        ))}
      </div>
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
    <main className="bg-background">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        <DashboardNav
          items={[
            { label: isEn ? "Dashboard" : "ড্যাশবোর্ড", href: "/dashboard" },
            { label: isEn ? "Alerts" : "সতর্কতা", href: "/alerts" },
            { label: isEn ? "Sudokkho AI" : "সুদক্ষ AI", href: "/copilot" },
            ...(user.is_admin ? [{ label: "Admin", href: "/admin" as const }] : []),
          ]}
        />

        {/* 1. Dashboard Headline */}
        <Suspense fallback={<GreetingSkeleton />}>
          <GreetingSection user={user as AuthUser} locale={locale} />
        </Suspense>

        {/* 2. Today's Next Steps Action Panel */}
        <Suspense fallback={<NextStepsSkeleton />}>
          <TodayNextSteps
            locale={locale}
            user={user as AuthUser}
            recommendationsPromise={recommendationsPromise}
            savedPromise={savedPromise}
          />
        </Suspense>

        {/* 3. Top 3 Recommendations */}
        <Suspense fallback={<RecommendationsSkeleton />}>
          <RecommendationsSection
            locale={locale}
            recommendationsPromise={recommendationsPromise}
          />
        </Suspense>

        {/* 4. Urgent / deadline-soon opportunities */}
        <Suspense fallback={<RecommendationsSkeleton />}>
          <UrgentDeadlinesSection
            locale={locale}
            recommendationsPromise={recommendationsPromise}
          />
        </Suspense>

        {/* 5. Saved items preview */}
        <Suspense fallback={<RecommendationsSkeleton />}>
          <SavedItemsSection
            locale={locale}
            savedPromise={savedPromise}
          />
        </Suspense>

        {/* 6. Sudokkho AI help card */}
        <Suspense fallback={<NextStepsSkeleton />}>
          <SudokkhoAiSection locale={locale} />
        </Suspense>

        {/* 7. Simple stats summary */}
        <Suspense fallback={<SecondaryStatsSkeleton />}>
          <SecondaryStatsSummary
            locale={locale}
            savedPromise={savedPromise}
            alertPromise={alertPromise}
            recommendationsPromise={recommendationsPromise}
          />
        </Suspense>

        {/* 8. Quick access links */}
        <section className="space-y-4" aria-labelledby="dashboard-quick-access">
          <div className="space-y-2">
            <h2 id="dashboard-quick-access" className="text-xl font-bold text-foreground">
              {isEn ? "🚀 Quick Access" : "🚀 দ্রুত যান"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {isEn
                ? "Open the pages you are most likely to need next."
                : "যে পেজগুলো আপনার সবচেয়ে বেশি দরকার হতে পারে সেগুলো দ্রুত খুলুন।"}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/saved" className="rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:border-primary hover:shadow-card-hover min-h-[76px] flex items-center">
              <div className="flex items-center gap-3 w-full">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40">
                  <Bookmark className="h-5 w-5 text-blue-600" />
                </div>
                <div className="leading-tight">
                  <p className="text-base font-semibold text-foreground">{isEn ? "Saved" : "সংরক্ষিত"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isEn ? "Saved items" : "সংরক্ষিত তালিকা"}
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/alerts" className="rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:border-primary hover:shadow-card-hover min-h-[76px] flex items-center">
              <div className="flex items-center gap-3 w-full">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/40">
                  <Bell className="h-5 w-5 text-amber-600" />
                </div>
                <div className="leading-tight">
                  <p className="text-base font-semibold text-foreground">{isEn ? "Alerts" : "সতর্কতা"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isEn ? "Alert rules" : "সতর্কতা নিয়ম"}
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/search?sort=deadline" className="rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:border-primary hover:shadow-card-hover min-h-[76px] flex items-center">
              <div className="flex items-center gap-3 w-full">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/40">
                  <AlertCircle className="h-5 w-5 text-rose-600" />
                </div>
                <div className="leading-tight">
                  <p className="text-base font-semibold text-foreground">{isEn ? "Urgent" : "জরুরি"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isEn ? "Closing soon" : "দ্রুত শেষ হবে"}
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
