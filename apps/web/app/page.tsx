import type { Route } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Globe,
  ShieldCheck,
  Sparkles,
  BookOpen,
  Briefcase,
  GraduationCap,
  FileText,
  AlertCircle,
} from "lucide-react";

import { NewsTicker } from "@/components/news-ticker";
import { OpportunityCard } from "@/components/opportunity-card";
import { Card } from "@/components/ui/card";
import { searchOpportunities } from "@/lib/api";
import { getLocale } from "@/lib/i18n";

async function getFeaturedOpportunities() {
  try {
    const params = new URLSearchParams({
      page_size: "3",
      sort: "trust",
    });
    return await searchOpportunities(params);
  } catch {
    return { items: [], total: 0, page: 1, page_size: 3 };
  }
}

async function getRecentOpportunities() {
  try {
    const params = new URLSearchParams({
      page_size: "6",
      sort: "newest",
    });
    return await searchOpportunities(params);
  } catch {
    return { items: [], total: 0, page: 1, page_size: 6 };
  }
}

type CategoryItem = {
  icon: (p: { className?: string }) => React.ReactNode;
  label: string;
  sub: string;
  href: Route;
  color: string;
  bg: string;
};

const CATEGORIES: CategoryItem[] = [
  {
    icon: Briefcase,
    label: "প্রবাস চাকরি",
    sub: "Foreign Jobs",
    href: "/search?record_type=job" as Route,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    icon: GraduationCap,
    label: "স্কলারশিপ",
    sub: "Scholarships",
    href: "/search?record_type=scholarship" as Route,
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-900/20",
  },
  {
    icon: BookOpen,
    label: "দক্ষতা প্রশিক্ষণ",
    sub: "Skill Training",
    href: "/search?source_class=bd_migration" as Route,
    color: "text-green-600",
    bg: "bg-green-50 dark:bg-green-900/20",
  },
  {
    icon: Globe,
    label: "ভিসা নীতি",
    sub: "Visa Policy",
    href: "/search?record_type=policy_update" as Route,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-900/20",
  },
  {
    icon: FileText,
    label: "সরকারি সার্কুলার",
    sub: "Official Circular",
    href: "/search?trust_tier=official_gov" as Route,
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-900/20",
  },
  {
    icon: AlertCircle,
    label: "সতর্কতা",
    sub: "Alerts",
    href: "/alerts" as Route,
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-900/20",
  },
];

const STATS = [
  { label: "যাচাই করা উৎস", value: "৯০+", en: "Sources" },
  { label: "সক্রিয় সুযোগ", value: "১২,৪৫০+", en: "Opportunities" },
  { label: "বিশ্বস্ত দেশ", value: "৪৫", en: "Countries" },
  { label: "নতুন আপডেট", value: "৩২০/দিন", en: "Daily Updates" },
];

const TRUST_FEATURES = [
  {
    icon: ShieldCheck,
    title: "সরকারি উৎস অগ্রাধিকার",
    body: "সরকারি ও অফিসিয়াল উৎস থেকে আসা তথ্য সবার আগে দেখানো হয়। প্রতিটি সুযোগের সাথে উৎস লিংক যুক্ত থাকে।",
  },
  {
    icon: Sparkles,
    title: "AI মিল বিশ্লেষণ",
    body: "আপনার প্রোফাইল ও পছন্দ অনুযায়ী সুযোগ বিশ্লেষণ করে সবচেয়ে প্রাসঙ্গিক তথ্য আগে দেখায়।",
  },
  {
    icon: CheckCircle,
    title: "নিয়মিত যাচাই",
    body: "প্রতিটি সুযোগ নিয়মিতভাবে যাচাই করা হয়। মেয়াদোত্তীর্ণ বা ভুল তথ্য স্বয়ংক্রিয়ভাবে সরিয়ে নেওয়া হয়।",
  },
];

export default async function HomePage() {
  const locale = await getLocale();
  const [featured, recent] = await Promise.all([
    getFeaturedOpportunities(),
    getRecentOpportunities(),
  ]);

  return (
    <div className="pb-16">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-navy text-white">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#07152f] via-[#0d1f45] to-[#1a3060] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:py-16 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            {/* Left: Copy */}
            <div className="space-y-6">
              <span className="inline-block rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide backdrop-blur">
                বিশ্বস্ত সুযোগের প্ল্যাটফর্ম
              </span>
              <h1 className="text-3xl font-bold leading-snug sm:text-4xl lg:text-5xl">
                বিদেশে চাকরি, স্কলারশিপ ও{" "}
                <span className="text-primary">মাইগ্রেশন আপডেট</span> এক জায়গায়
              </h1>
              <p className="max-w-xl text-base text-slate-300 leading-relaxed">
                বাংলাদেশিদের জন্য যাচাই করা চাকরি, প্রশিক্ষণ, ভিসা নীতি ও
                স্কলারশিপ তথ্য সহজভাবে খুঁজুন।
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
                >
                  সুযোগ খুঁজুন
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/auth/register"
                  className="inline-flex items-center gap-2 rounded-md border border-white/30 bg-white/10 px-6 py-3 text-sm font-bold text-white hover:bg-white/20 transition-colors backdrop-blur"
                >
                  ফ্রি অ্যাকাউন্ট খুলুন
                </Link>
              </div>
            </div>

            {/* Right: Stats cards */}
            <div className="grid grid-cols-2 gap-3">
              {STATS.map(({ label, value, en }) => (
                <div
                  key={label}
                  className="rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur"
                >
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="mt-1 text-sm font-medium text-slate-200">{label}</p>
                  <p className="text-[11px] text-slate-400">{en}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── News Ticker ── */}
      <NewsTicker />

      {/* ── Category blocks ── */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-foreground section-underline">
            বিভাগ অনুযায়ী খুঁজুন
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map(({ icon: Icon, label, sub, href, color, bg }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center hover:border-primary hover:shadow-card-hover transition-all"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {label}
                </p>
                <p className="text-[10px] text-muted-foreground">{sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Featured + Most Viewed ── */}
      {featured.items.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-4">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground section-underline">
              বিশ্বস্ত সুযোগ
            </h2>
            <Link
              href="/search?sort=trust"
              className="text-sm font-semibold text-primary hover:underline"
            >
              সব দেখুন →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {featured.items.map((item) => (
              <OpportunityCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* ── Latest + Sidebar ── */}
      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Latest */}
          <div>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground section-underline">
                সর্বশেষ সুযোগ
              </h2>
              <Link
                href="/search?sort=newest"
                className="text-sm font-semibold text-primary hover:underline"
              >
                সব দেখুন →
              </Link>
            </div>
            <div className="space-y-4">
              {recent.items.length === 0 ? (
                <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
                  <p>এই মুহূর্তে কোনো সুযোগ পাওয়া যাচ্ছে না।</p>
                </div>
              ) : (
                recent.items.map((item) => (
                  <OpportunityCard key={item.id} item={item} />
                ))
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Quick links card */}
            <Card>
              <h3 className="mb-3 text-base font-bold section-underline">
                দ্রুত অ্যাক্সেস
              </h3>
              <div className="space-y-1">
                {(
                [
                  { label: "কানাডার চাকরি", href: "/search?country=Canada&record_type=job" as Route },
                  { label: "জার্মানি Ausbildung", href: "/search?country=Germany" as Route },
                  { label: "মালয়েশিয়া কর্মসংস্থান", href: "/search?country=Malaysia&record_type=job" as Route },
                  { label: "Erasmus স্কলারশিপ", href: "/search?record_type=scholarship&q=Erasmus" as Route },
                  { label: "UK ভিসা আপডেট", href: "/search?country=UK&record_type=policy_update" as Route },
                  { label: "কোরিয়া EPS প্রোগ্রাম", href: "/search?country=Korea&record_type=job" as Route },
                ] satisfies { label: string; href: Route }[]
              ).map(({ label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted hover:text-primary transition-colors"
                  >
                    <span>{label}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </Card>

            {/* AI Copilot CTA */}
            <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-bold text-foreground">AI Copilot</span>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                আপনার প্রোফাইল অনুযায়ী সবচেয়ে ভালো সুযোগ খুঁজে পেতে AI
                সহকারী ব্যবহার করুন।
              </p>
              <Link
                href="/copilot"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition-opacity"
              >
                AI-তে জিজ্ঞেস করুন
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Trust notice */}
            <Card>
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                <div>
                  <p className="text-sm font-bold text-foreground">
                    বিশ্বাসযোগ্যতার নিশ্চয়তা
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    প্রতিটি সুযোগ সরকারি বা অফিসিয়াল উৎস থেকে সংগৃহীত। কোনো
                    অর্থ লেনদেনের আগে মূল উৎস যাচাই করুন।
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Trust features ── */}
      <section className="border-t border-border bg-muted/40 py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-foreground">
              কেন আমাদের বিশ্বাস করবেন?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              বাংলাদেশিদের জন্য নির্ভরযোগ্য ও যাচাই করা বিদেশি সুযোগের
              প্ল্যাটফর্ম
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {TRUST_FEATURES.map(({ icon: Icon, title, body }) => (
              <Card key={title}>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 font-bold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="bg-navy py-12 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            আজই শুরু করুন — বিনামূল্যে
          </h2>
          <p className="mt-3 text-slate-300">
            অ্যাকাউন্ট খুলুন, সুযোগ সংরক্ষণ করুন এবং সতর্কতা চালু রাখুন।
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/register"
              className="rounded-md bg-primary px-6 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
            >
              ফ্রি অ্যাকাউন্ট তৈরি করুন
            </Link>
            <Link
              href="/search"
              className="rounded-md border border-white/30 px-6 py-3 text-sm font-bold text-white hover:bg-white/10 transition-colors"
            >
              সুযোগ খুঁজুন
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
