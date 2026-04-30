import type { Route } from "next";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Briefcase,
  FileText,
  Globe,
  GraduationCap,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { HeroSlider } from "@/components/hero-slider";
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

async function getTickerOpportunities() {
  try {
    const params = new URLSearchParams({ page_size: "12", sort: "newest" });
    const response = await searchOpportunities(params);
    return response.items.map(({ id, title, title_bn, opportunity_type }) => ({
      id,
      title,
      title_bn,
      opportunity_type,
    }));
  } catch {
    return [];
  }
}

type CategoryItem = {
  icon: (props: { className?: string }) => React.ReactNode;
  label: string;
  labelEn: string;
  href: Route;
  color: string;
  bg: string;
};

const CATEGORIES: CategoryItem[] = [
  {
    icon: Briefcase,
    label: "প্রবাস চাকরি",
    labelEn: "Overseas Jobs",
    href: "/search?record_type=job" as Route,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/40",
  },
  {
    icon: GraduationCap,
    label: "স্কলারশিপ",
    labelEn: "Scholarships",
    href: "/search?record_type=scholarship" as Route,
    color: "text-fuchsia-600",
    bg: "bg-fuchsia-50 dark:bg-fuchsia-950/40",
  },
  {
    icon: BookOpen,
    label: "দক্ষতা প্রশিক্ষণ",
    labelEn: "Skill Training",
    href: "/search?source_class=bd_migration" as Route,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
  {
    icon: Globe,
    label: "ভিসা নীতি",
    labelEn: "Visa Policy",
    href: "/search?record_type=policy_update" as Route,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/40",
  },
  {
    icon: FileText,
    label: "সরকারি সার্কুলার",
    labelEn: "Official Circulars",
    href: "/search?trust_tier=official_gov" as Route,
    color: "text-rose-600",
    bg: "bg-rose-50 dark:bg-rose-950/40",
  },
  {
    icon: AlertCircle,
    label: "সতর্কতা",
    labelEn: "Alerts",
    href: "/alerts" as Route,
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-950/40",
  },
];

const TRUST_FEATURES = [
  {
    icon: ShieldCheck,
    title: "সরকারি উৎস অগ্রাধিকার",
    titleEn: "Official Sources First",
    body: "প্রতিটি সুযোগে উৎসের ধরন, ট্রাস্ট ব্যাজ, এবং যাচাইয়ের দিকনির্দেশ একসাথে দেখুন।",
    bodyEn: "See source type, trust badges, and verification guidance together on every listing.",
  },
  {
    icon: Sparkles,
    title: "বাংলাদেশি আবেদনকারীদের জন্য সহজ ফিল্টার",
    titleEn: "Simple Filters for BD Applicants",
    body: "বাংলাদেশ থেকে আবেদনযোগ্য কিনা, কোন দেশে সুযোগ আছে, আর কখন শেষ তারিখ - দ্রুত বুঝে নিন।",
    bodyEn: "Quickly understand whether you can apply from Bangladesh, where the opportunity is, and when it closes.",
  },
  {
    icon: AlertCircle,
    title: "নিরাপদ সিদ্ধান্তের জন্য পরিষ্কার তথ্য",
    titleEn: "Clear Information for Safer Decisions",
    body: "জটিল তথ্যকে সহজ ভাষায় সাজানো হয়েছে, যাতে নথি, বেতন, আর প্রক্রিয়া বুঝতে সুবিধা হয়।",
    bodyEn: "Complex details are simplified so documents, salary, and process are easier to understand.",
  },
];

export default async function HomePage() {
  const locale = await getLocale();
  const isEn = locale === "en";
  const [featured, recent, tickerItems] = await Promise.all([
    getFeaturedOpportunities(),
    getRecentOpportunities(),
    getTickerOpportunities(),
  ]);

  return (
    <main className="space-y-8 bg-background pb-8">
      <HeroSlider />
      <NewsTicker items={tickerItems} />

      <section className="mx-auto max-w-7xl space-y-8 px-4" aria-labelledby="home-categories">
        <div className="space-y-2">
          <h2 id="home-categories" className="section-underline text-xl font-bold text-foreground">
            {isEn ? "Browse by Category" : "বিভাগ অনুযায়ী খুঁজুন"}
          </h2>
          <p className="text-muted-foreground">
            {isEn
              ? "Start from the type of opportunity you need most."
              : "আপনার প্রয়োজনের ধরন অনুযায়ী সুযোগ বেছে নিন।"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map(({ icon: Icon, label, labelEn, href, color, bg }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-2xl border border-border bg-card p-4 text-center shadow-card transition-all hover:border-primary hover:shadow-card-hover sm:p-5"
            >
              <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${bg}`}>
                <Icon className={`h-6 w-6 ${color}`} />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground group-hover:text-primary">
                {isEn ? labelEn : label}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {featured.items.length > 0 && (
        <section className="mx-auto max-w-7xl space-y-4 px-4" aria-labelledby="featured-opportunities">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <h2 id="featured-opportunities" className="section-underline text-xl font-bold text-foreground">
                {isEn ? "Trusted Opportunities" : "বিশ্বস্ত সুযোগ"}
              </h2>
              <p className="text-muted-foreground">
                {isEn
                  ? "High-trust listings with clear application links and deadlines."
                  : "যাচাই করা উৎস, স্পষ্ট আবেদন লিংক, আর পরিষ্কার শেষ তারিখসহ বাছাই করা সুযোগ।"}
              </p>
            </div>
            <Link href="/search?sort=trust" className="text-sm font-semibold text-primary hover:underline">
              {isEn ? "View all" : "সব দেখুন"} →
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {featured.items.map((item) => (
              <OpportunityCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4" aria-labelledby="latest-opportunities">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <h2 id="latest-opportunities" className="section-underline text-xl font-bold text-foreground">
                  {isEn ? "Latest Opportunities" : "সর্বশেষ সুযোগ"}
                </h2>
                <p className="text-muted-foreground">
                  {isEn
                    ? "Updated listings across jobs, scholarships, and visa notices."
                    : "চাকরি, স্কলারশিপ, আর ভিসা নোটিশের নতুন আপডেট একসাথে দেখুন।"}
                </p>
              </div>
              <Link href="/search?sort=newest" className="text-sm font-semibold text-primary hover:underline">
                {isEn ? "View all" : "সব দেখুন"} →
              </Link>
            </div>

            <div className="space-y-4">
              {recent.items.length === 0 ? (
                <Card className="text-center">
                  <p className="font-semibold text-foreground">
                    {isEn ? "No opportunities available right now." : "এই মুহূর্তে কোনো সুযোগ পাওয়া যাচ্ছে না।"}
                  </p>
                </Card>
              ) : (
                recent.items.map((item) => <OpportunityCard key={item.id} item={item} />)
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <Card>
              <h3 className="section-underline text-base font-semibold text-foreground">
                {isEn ? "Quick Access" : "দ্রুত অ্যাক্সেস"}
              </h3>
              <div className="mt-4 space-y-1">
                {[
                  { label: "কানাডার চাকরি", labelEn: "Jobs in Canada", href: "/search?country=Canada&record_type=job" as Route },
                  { label: "মালয়েশিয়া কর্মসংস্থান", labelEn: "Malaysia jobs", href: "/search?country=Malaysia&record_type=job" as Route },
                  { label: "জার্মানি স্কিল প্রোগ্রাম", labelEn: "Germany skill programs", href: "/search?country=Germany" as Route },
                  { label: "সরকারি সার্কুলার", labelEn: "Official circulars", href: "/search?trust_tier=official_gov" as Route },
                ].map(({ label, labelEn, href }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted hover:text-primary"
                  >
                    <span>{isEn ? labelEn : label}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            </Card>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold text-foreground">AI Copilot</h3>
              </div>
              <p className="text-muted-foreground">
                {isEn
                  ? "Ask AI to explain a listing, compare countries, or help you prepare next steps."
                  : "AI-কে দিয়ে সুযোগ বুঝুন, দেশ তুলনা করুন, আর পরের করণীয় জেনে নিন।"}
              </p>
              <Link
                href="/copilot"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                <span>{isEn ? "Ask AI" : "AI-কে জিজ্ঞেস করুন"}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <section className="bg-muted/40 py-12" aria-labelledby="trust-features">
        <div className="mx-auto max-w-7xl space-y-8 px-4">
          <div className="space-y-2 text-center">
            <h2 id="trust-features" className="text-3xl font-bold text-foreground">
              {isEn ? "Built for Clarity and Trust" : "বিশ্বাস ও স্পষ্টতার জন্য তৈরি"}
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              {isEn
                ? "The platform is designed so non-technical users can understand opportunities faster and more safely."
                : "প্ল্যাটফর্মটি এমনভাবে সাজানো হয়েছে যাতে সাধারণ ব্যবহারকারীরা দ্রুত এবং নিরাপদভাবে সুযোগ বুঝতে পারেন।"}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {TRUST_FEATURES.map(({ icon: Icon, title, titleEn, body, bodyEn }) => (
              <Card key={title}>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {isEn ? titleEn : title}
                </h3>
                <p className="mt-2 text-muted-foreground">
                  {isEn ? bodyEn : body}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
