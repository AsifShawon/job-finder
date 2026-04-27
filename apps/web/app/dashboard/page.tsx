import type { Route } from "next";
import type { FC } from "react";
import Link from "next/link";
import {
  Bookmark,
  Bell,
  Sparkles,
  TrendingUp,
  ArrowRight,
  AlertCircle,
  LayoutDashboard,
} from "lucide-react";

import { OpportunityCard } from "@/components/opportunity-card";
import { Card } from "@/components/ui/card";
import { fetchBackendJsonWithAuth, requireCurrentUser } from "@/lib/server-auth-fetch";
import { getLocale, getT } from "@/lib/i18n";
import type { AlertRulePage, OpportunityCard as OppCard, RecommendationResponse } from "@/lib/types";

export default async function DashboardPage() {
  const [user, locale] = await Promise.all([requireCurrentUser(), getLocale()]);
  const isEn = locale === "en";
  const t = await getT("dashboard");

  const [savedItems, alertData, recommendations] = await Promise.all([
    fetchBackendJsonWithAuth<OppCard[]>("/api/v1/saved"),
    fetchBackendJsonWithAuth<AlertRulePage>("/api/v1/alerts"),
    fetchBackendJsonWithAuth<RecommendationResponse>("/api/v1/recommendations?page_size=6"),
  ]);

  const saved = savedItems ?? [];
  const alerts = alertData?.items ?? [];
  const recItems = recommendations?.items ?? [];
  const activeAlerts = alerts.filter((a) => a.is_active).length;
  const urgentItems = recItems.filter((item) => {
    if (!item.deadline) return false;
    const days = Math.ceil(
      (new Date(item.deadline + "T00:00:00Z").getTime() - Date.now()) / 86400000
    );
    return days >= 0 && days <= 7;
  }).length;

  const firstName = user.full_name.split(" ")[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <LayoutDashboard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {isEn ? `Welcome, ${firstName}` : `স্বাগতম, ${firstName}`}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isEn
                    ? "Your personalized opportunity dashboard"
                    : "আপনার জন্য মিলে যাওয়া সুযোগের ড্যাশবোর্ড"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/search"
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary hover:text-primary transition-colors"
              >
                {isEn ? "Explore" : "সুযোগ খুঁজুন"}
              </Link>
              <Link
                href="/copilot"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI Copilot
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Onboarding banner */}
        {!user.onboarding_complete && (
          <div className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/10 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning shrink-0" />
              <span className="text-sm font-medium text-foreground">
                {isEn
                  ? "Complete your profile to get personalized recommendations."
                  : "ব্যক্তিগত সুপারিশ পেতে আপনার প্রোফাইল সম্পন্ন করুন।"}
              </span>
            </div>
            <Link
              href="/onboarding"
              className="shrink-0 rounded-md bg-warning px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
            >
              {isEn ? "Complete now" : "এখনই করুন"}
            </Link>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              {
                icon: Bookmark,
                value: saved.length,
                label: isEn ? "Saved" : "সংরক্ষিত",
                href: "/saved" as Route,
                color: "text-blue-600",
                bg: "bg-blue-50 dark:bg-blue-900/20",
              },
              {
                icon: Bell,
                value: activeAlerts,
                label: isEn ? "Active alerts" : "সক্রিয় সতর্কতা",
                href: "/alerts" as Route,
                color: "text-amber-600",
                bg: "bg-amber-50 dark:bg-amber-900/20",
              },
              {
                icon: TrendingUp,
                value: recItems.length,
                label: isEn ? "Recommended" : "সুপারিশকৃত",
                href: "/search" as Route,
                color: "text-primary",
                bg: "bg-primary/10",
              },
              {
                icon: AlertCircle,
                value: urgentItems,
                label: isEn ? "Urgent deadlines" : "শেষ তারিখ নিকটে",
                href: "/search?sort=deadline" as Route,
                color: "text-red-600",
                bg: "bg-red-50 dark:bg-red-900/20",
              },
            ] satisfies { icon: FC<{ className?: string }>; value: number; label: string; href: Route; color: string; bg: string }[]
          ).map(({ icon: Icon, value, label, href, color, bg }) => (
            <Link
              key={label}
              href={href}
              className="group rounded-lg border border-border bg-card p-4 shadow-card hover:border-primary hover:shadow-card-hover transition-all"
            >
              <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </Link>
          ))}
        </div>

        {/* Main content */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Left: Recommendations */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground section-underline">
                {isEn ? "Recommended for you" : "আপনার জন্য সুপারিশ"}
              </h2>
              <Link href="/search" className="text-sm font-semibold text-primary hover:underline">
                {isEn ? "View all →" : "সব দেখুন →"}
              </Link>
            </div>

            {recItems.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-8 text-center">
                <Sparkles className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="font-semibold text-foreground">
                  {isEn ? "Complete your profile" : "প্রোফাইল সম্পন্ন করুন"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isEn
                    ? "We need your preferences to show relevant recommendations."
                    : "প্রাসঙ্গিক সুপারিশ দেখাতে আপনার পছন্দ জানা দরকার।"}
                </p>
                <Link
                  href="/onboarding"
                  className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-bold text-white hover:opacity-90"
                >
                  {isEn ? "Set up profile" : "প্রোফাইল সেটআপ করুন"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recItems.map((item) => (
                  <OpportunityCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Saved shortlist */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold text-foreground section-underline">
                  {isEn ? "Saved" : "সংরক্ষিত"}
                </h3>
                <Link href="/saved" className="text-xs font-semibold text-primary hover:underline">
                  {isEn ? "View all" : "সব দেখুন"}
                </Link>
              </div>
              {saved.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {isEn ? "Nothing saved yet." : "এখনো কিছু সংরক্ষণ করা হয়নি।"}
                </p>
              ) : (
                <div className="space-y-2">
                  {saved.slice(0, 4).map((item) => (
                    <Link
                      key={item.id}
                      href={`/opportunity/${item.id}`}
                      className="block rounded-md border border-border p-3 text-sm hover:border-primary transition-colors group"
                    >
                      <p className="line-clamp-1 font-medium text-foreground group-hover:text-primary">
                        {item.title}
                      </p>
                      {item.country && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.country}</p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            {/* Alerts */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold text-foreground section-underline">
                  {isEn ? "Alert rules" : "সতর্কতার নিয়ম"}
                </h3>
                <Link href="/alerts" className="text-xs font-semibold text-primary hover:underline">
                  {isEn ? "Edit" : "সম্পাদনা"}
                </Link>
              </div>
              {alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {isEn ? "No alerts set up yet." : "কোনো সতর্কতা নেই।"}
                </p>
              ) : (
                <div className="space-y-2">
                  {alerts.slice(0, 3).map((alert) => (
                    <div key={alert.id} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{alert.name}</p>
                        {alert.is_active ? (
                          <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900/20 dark:text-green-400">
                            {isEn ? "Active" : "সক্রিয়"}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {isEn ? "Off" : "বন্ধ"}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        {alert.query_text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <Link
                href="/alerts"
                className="mt-3 flex items-center justify-center gap-1.5 rounded-md border border-border py-2 text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
              >
                + {isEn ? "New alert" : "নতুন সতর্কতা"}
              </Link>
            </Card>

            {/* AI copilot promo */}
            <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">AI Copilot</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {isEn
                  ? "Ask AI to analyze any opportunity or find the best match for your profile."
                  : "যেকোনো সুযোগ বিশ্লেষণ করতে বা আপনার প্রোফাইলের জন্য সেরা মিল খুঁজতে AI-কে জিজ্ঞেস করুন।"}
              </p>
              <Link
                href="/copilot"
                className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
              >
                {isEn ? "Start chatting" : "শুরু করুন"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
