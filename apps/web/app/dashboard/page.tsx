import Link from "next/link";
import { Suspense } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Bookmark,
  Calendar,
  CheckCircle,
  Sparkles,
} from "lucide-react";

import { DashboardNav } from "@/components/dashboard-nav";
import { OpportunityCard } from "@/components/opportunity-card";
import { Card } from "@/components/ui/card";
import { fetchBackendJsonWithAuth, requireCurrentUser } from "@/lib/server-auth-fetch";
import { getLocale } from "@/lib/i18n";
import type {
  AlertRulePage,
  OpportunityCard as OppCard,
  RecommendationResponse,
} from "@/lib/types";

async function GreetingSection({
  user,
  locale,
  recommendationsPromise,
}: {
  user: Awaited<ReturnType<typeof requireCurrentUser>>;
  locale: "bn" | "en";
  recommendationsPromise: Promise<RecommendationResponse | null>;
}) {
  const recommendations = await recommendationsPromise;
  const recItems = recommendations?.items ?? [];
  const isEn = locale === "en";
  const firstName = user.full_name.split(" ")[0] || user.full_name;
  const urgentItems = recItems.filter((item) => {
    if (!item.deadline) {
      return false;
    }

    const days = Math.ceil(
      (new Date(`${item.deadline}T00:00:00Z`).getTime() - Date.now()) / 86400000,
    );
    return days >= 0 && days <= 7;
  }).length;

  return (
    <section className="space-y-3" aria-label={isEn ? "Dashboard greeting" : "ড্যাশবোর্ড অভিবাদন"}>
      <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
        {isEn
          ? `Assalamu Alaikum, ${firstName}! 👋`
          : `আস্সালামুয়ালাইকুম, ${firstName} ভাই/আপা! 👋`}
      </h1>
      <p className="text-base text-muted-foreground">
        {isEn
          ? `You have ${recItems.length} new opportunities today.`
          : `আজকে আপনার জন্য ${recItems.length}টি নতুন সুযোগ আছে`}
      </p>
      {urgentItems > 0 && (
        <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-200">
          ⚡ {isEn ? `${urgentItems} closing soon` : `${urgentItems}টি সুযোগের শেষ তারিখ আসছে`}
        </span>
      )}
    </section>
  );
}

function GreetingSkeleton() {
  return (
    <section className="space-y-3" aria-hidden="true">
      <div className="h-10 w-64 animate-pulse rounded-xl bg-muted" />
      <div className="h-4 w-72 animate-pulse rounded bg-muted" />
      <div className="h-6 w-40 animate-pulse rounded-full bg-muted" />
    </section>
  );
}

async function QuickStatsBar({
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
    if (!item.deadline) {
      return false;
    }

    const days = Math.ceil(
      (new Date(`${item.deadline}T00:00:00Z`).getTime() - Date.now()) / 86400000,
    );
    return days >= 0 && days <= 7;
  }).length;
  const canApplyFromBd = recItems.filter((item) => item.can_apply_from_bd).length;
  const isEn = locale === "en";

  const stats = [
    {
      icon: Bookmark,
      value: saved.length,
      label: isEn ? "Saved" : "সংরক্ষিত",
    },
    {
      icon: Bell,
      value: activeAlerts,
      label: isEn ? "Active alerts" : "সক্রিয় সতর্কতা",
    },
    {
      icon: Calendar,
      value: urgentItems,
      label: isEn ? "Expiring soon" : "শেষ তারিখ আসছে",
    },
    {
      icon: CheckCircle,
      value: canApplyFromBd,
      label: isEn ? "Apply from BD" : "বাংলাদেশ থেকে আবেদন",
    },
  ];

  return (
    <section className="space-y-3" aria-label={isEn ? "Quick stats" : "দ্রুত পরিসংখ্যান"}>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none md:grid md:grid-cols-4 md:overflow-visible">
        {stats.map(({ icon: Icon, value, label }) => (
          <div
            key={label}
            className="flex min-w-[160px] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/70">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{value}</p>
              <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function QuickStatsSkeleton() {
  return (
    <section className="space-y-3" aria-hidden="true">
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none md:grid md:grid-cols-4 md:overflow-visible">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`stat-${index}`}
            className="flex min-w-[160px] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
          >
            <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
            <div className="space-y-2">
              <div className="h-5 w-10 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
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
  const isEn = locale === "en";

  return (
    <section className="space-y-4" aria-labelledby="dashboard-recommendations">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <h2 id="dashboard-recommendations" className="section-underline text-xl font-bold text-foreground">
            {isEn ? "🌟 Selected for you" : "🌟 আপনার জন্য বাছাই করা সুযোগ"}
          </h2>
          <p className="text-muted-foreground">
            {isEn
              ? "Recommendations based on your interests and recent activity."
              : "আপনার আগ্রহ ও সাম্প্রতিক কাজের ভিত্তিতে সাজানো সুযোগ।"}
          </p>
        </div>
        <Link href="/search" className="text-sm font-semibold text-primary hover:underline" aria-label={isEn ? "Browse all opportunities" : "সব সুযোগ দেখুন"}>
          {isEn ? "Browse all" : "সব দেখুন"} →
        </Link>
      </div>

      {recItems.length === 0 ? (
        <Card className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl">
            🌱
          </div>
          <h3 className="mt-4 text-xl font-bold text-foreground">
            {isEn ? "No recommendations yet" : "এখনো সুপারিশ করার মতো সুযোগ নেই"}
          </h3>
          <p className="mt-2 text-muted-foreground">
            {isEn
              ? "Complete your profile or change your sector to see better matches."
              : "আপনার প্রোফাইল আরও পূর্ণ করুন বা সেক্টর পরিবর্তন করুন"}
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-bold text-white"
              aria-label={isEn ? "Update profile" : "প্রোফাইল আপডেট করুন"}
            >
              {isEn ? "Update profile" : "প্রোফাইল আপডেট করুন"}
            </Link>
            <Link
              href="/search"
              className="inline-flex items-center justify-center rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground"
              aria-label={isEn ? "View all opportunities" : "সব সুযোগ দেখুন"}
            >
              {isEn ? "View all opportunities" : "সব সুযোগ দেখুন"}
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {recItems.map((item) => (
            <OpportunityCard key={item.id} item={item} showMatchBanner />
          ))}
        </div>
      )}
    </section>
  );
}

function RecommendationsSkeleton() {
  return (
    <section className="space-y-4" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={`rec-skeleton-${index}`} className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card">
          <span className="absolute left-0 top-0 h-full w-1 bg-muted" />
          <div className="space-y-4">
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
            <div className="h-7 w-4/5 animate-pulse rounded bg-muted" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      ))}
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
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6">
        <DashboardNav
          items={[
            { label: isEn ? "Dashboard" : "ড্যাশবোর্ড", href: "/dashboard" },
            { label: isEn ? "Alerts" : "সতর্কতা", href: "/alerts" },
            { label: "AI Copilot", href: "/copilot" },
            ...(user.is_admin ? [{ label: "Admin", href: "/admin" as const }] : []),
          ]}
        />

        <Suspense fallback={<GreetingSkeleton />}>
          <GreetingSection
            user={user}
            locale={locale}
            recommendationsPromise={recommendationsPromise}
          />
        </Suspense>

        <Suspense fallback={<QuickStatsSkeleton />}>
          <QuickStatsBar
            locale={locale}
            savedPromise={savedPromise}
            alertPromise={alertPromise}
            recommendationsPromise={recommendationsPromise}
          />
        </Suspense>

        <Suspense fallback={<RecommendationsSkeleton />}>
          <RecommendationsSection
            locale={locale}
            recommendationsPromise={recommendationsPromise}
          />
        </Suspense>

        <section className="space-y-4" aria-labelledby="dashboard-quick-access">
          <div className="space-y-2">
            <h2 id="dashboard-quick-access" className="section-underline text-xl font-bold text-foreground">
              {isEn ? "🚀 Quick Access" : "🚀 দ্রুত যান"}
            </h2>
            <p className="text-muted-foreground">
              {isEn
                ? "Open the pages you are most likely to need next."
                : "যে পেজগুলো আপনার সবচেয়ে বেশি দরকার হতে পারে সেগুলো দ্রুত খুলুন।"}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/saved" className="rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:border-primary hover:shadow-card-hover">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40">
                  <Bookmark className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">{isEn ? "Saved" : "সংরক্ষিত"}</p>
                  <p className="text-muted-foreground">
                    {isEn ? "Saved items" : "সংরক্ষিত তালিকা"}
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/alerts" className="rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:border-primary hover:shadow-card-hover">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/40">
                  <Bell className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">{isEn ? "Alerts" : "সতর্কতা"}</p>
                  <p className="text-muted-foreground">
                    {isEn ? "Alert rules" : "সতর্কতা নিয়ম"}
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/search?sort=deadline" className="rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:border-primary hover:shadow-card-hover">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/40">
                  <AlertCircle className="h-5 w-5 text-rose-600" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">{isEn ? "Urgent" : "জরুরি"}</p>
                  <p className="text-muted-foreground">
                    {isEn ? "Closing soon" : "দ্রুত শেষ হবে"}
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5" aria-label={isEn ? "AI assistant" : "AI সহকারী"}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">AI Copilot</h2>
              </div>
              <p className="text-muted-foreground">
                {isEn
                  ? "Ask AI to explain a listing, compare countries, or suggest your next step."
                  : "AI-কে দিয়ে সুযোগ বুঝুন, দেশ তুলনা করুন, বা পরের করণীয় জেনে নিন।"}
              </p>
            </div>
            <Link
              href="/copilot"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white"
            >
              <span>{isEn ? "Open AI Copilot" : "AI Copilot খুলুন"}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
