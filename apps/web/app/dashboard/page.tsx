import Link from "next/link";
import { AlertCircle, ArrowRight, Bell, Bookmark, Sparkles } from "lucide-react";

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

export default async function DashboardPage() {
  const [user, locale] = await Promise.all([requireCurrentUser(), getLocale()]);
  const isEn = locale === "en";

  const [savedItems, alertData, recommendations] = await Promise.all([
    fetchBackendJsonWithAuth<OppCard[]>("/api/v1/saved"),
    fetchBackendJsonWithAuth<AlertRulePage>("/api/v1/alerts"),
    fetchBackendJsonWithAuth<RecommendationResponse>("/api/v1/recommendations?page_size=6"),
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

        <section className="space-y-2" aria-label={isEn ? "Dashboard intro" : "ড্যাশবোর্ড পরিচিতি"}>
          <p className="text-sm font-semibold text-primary">
            {isEn ? "Your Dashboard" : "আপনার ড্যাশবোর্ড"}
          </p>
          <h1 className="text-3xl font-bold text-foreground">
            {isEn ? `Welcome back, ${user.full_name.split(" ")[0]}` : `${user.full_name.split(" ")[0]}, স্বাগতম`}
          </h1>
          <p className="text-muted-foreground">
            {isEn
              ? "See the opportunities, alerts, and saved items that matter most to you."
              : "আপনার জন্য সবচেয়ে গুরুত্বপূর্ণ সুযোগ, সতর্কতা, আর সংরক্ষিত তালিকা একসাথে দেখুন।"}
          </p>
        </section>

        <section className="space-y-4" aria-labelledby="dashboard-recommendations">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <h2 id="dashboard-recommendations" className="section-underline text-xl font-bold text-foreground">
                {isEn ? "Opportunities for You" : "আপনার জন্য সুযোগ"}
              </h2>
              <p className="text-muted-foreground">
                {isEn
                  ? "Recommendations based on your recent interests and saved items."
                  : "আপনার আগ্রহ ও সংরক্ষিত তালিকার ভিত্তিতে সাজানো সুযোগ।"}
              </p>
            </div>
            <Link href="/search" className="text-sm font-semibold text-primary hover:underline">
              {isEn ? "Browse all" : "সব দেখুন"} →
            </Link>
          </div>

          {recItems.length === 0 ? (
            <Card className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-foreground">
                {isEn ? "No recommendations yet" : "এখনো সাজানো সুযোগ নেই"}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {isEn
                  ? "Start saving a few listings to improve your recommendations."
                  : "কয়েকটি সুযোগ সংরক্ষণ করলে আপনার জন্য আরও ভালো সাজেশন পাওয়া যাবে।"}
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {recItems.map((item) => (
                <OpportunityCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4" aria-labelledby="dashboard-quick-access">
          <div className="space-y-2">
            <h2 id="dashboard-quick-access" className="section-underline text-xl font-bold text-foreground">
              {isEn ? "Quick Access" : "দ্রুত অ্যাক্সেস"}
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
                    {saved.length} {isEn ? "items" : "টি সুযোগ"}
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
                    {activeAlerts} {isEn ? "active rules" : "টি সক্রিয় নিয়ম"}
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
                    {urgentItems} {isEn ? "close soon" : "টি দ্রুত শেষ হবে"}
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
