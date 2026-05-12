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

import { Hero } from "@/components/hero";
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
    label: "বিদেশি চাকরি",
    labelEn: "Overseas Jobs",
    href: "/search?record_type=job" as Route,
    color: "text-primary",
    bg: "bg-primary/5",
  },
  {
    icon: GraduationCap,
    label: "স্কলারশিপ",
    labelEn: "Scholarships",
    href: "/search?record_type=scholarship" as Route,
    color: "text-primary",
    bg: "bg-primary/5",
  },
  {
    icon: BookOpen,
    label: "দক্ষতা প্রশিক্ষণ",
    labelEn: "Skill Training",
    href: "/search?source_class=bd_migration" as Route,
    color: "text-primary",
    bg: "bg-primary/5",
  },
  {
    icon: Globe,
    label: "ভিসা ও নীতি",
    labelEn: "Visa & Policy",
    href: "/search?record_type=policy_update" as Route,
    color: "text-primary",
    bg: "bg-primary/5",
  },
  {
    icon: FileText,
    label: "সরকারি সার্কুলার",
    labelEn: "Official Circulars",
    href: "/search?trust_tier=official_gov" as Route,
    color: "text-primary",
    bg: "bg-primary/5",
  },
  {
    icon: AlertCircle,
    label: "সতর্কতা",
    labelEn: "Alerts",
    href: "/alerts" as Route,
    color: "text-primary",
    bg: "bg-primary/5",
  },
];

const TRUST_FEATURES = [
  {
    icon: ShieldCheck,
    title: "যাচাই করা সরকারি উৎস",
    titleEn: "Verified Official Sources",
    body: "আমরা সরাসরি সরকারি এবং বিশ্বস্ত সাইট থেকে তথ্য সংগ্রহ করি, যাতে আপনার কাছে সঠিক তথ্য পৌঁছায়।",
    bodyEn: "We aggregate opportunities directly from official and high-trust sources for your safety.",
  },
  {
    icon: AlertCircle,
    title: "পরিষ্কার শেষ তারিখ",
    titleEn: "Clear Deadlines",
    body: "আবেদনের শেষ তারিখ এবং সময়সীমা স্পষ্টভাবে দেওয়া থাকে যাতে আপনার সুযোগ মিস না হয়।",
    bodyEn: "Application deadlines are clearly highlighted so you never miss an opportunity.",
  },
  {
    icon: Sparkles,
    title: "নিরাপদ আবেদন নির্দেশিকা",
    titleEn: "Safe Application Guidance",
    body: "জটিল প্রক্রিয়াকে সহজ করে তোলা হয়েছে, যাতে আপনি নিজে থেকেই সঠিক উপায়ে আবেদন করতে পারেন।",
    bodyEn: "Complex processes are simplified so you can apply safely through official channels.",
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
      <Hero isEn={isEn} />
      <div className="bg-card py-4 border-y border-border">
        <NewsTicker items={tickerItems} />
      </div>

      <section className="mx-auto max-w-7xl space-y-8 px-4 py-8" aria-labelledby="home-categories">
        <div className="text-center space-y-3">
          <h2 id="home-categories" className="text-2xl font-bold text-foreground">
            {isEn ? "What are you looking for?" : "আপনি কী খুঁজছেন?"}
          </h2>
          <p className="text-muted-foreground">
            {isEn
              ? "Select a service to explore verified opportunities."
              : "যাচাই করা সুযোগগুলো দেখতে একটি সেবা বেছে নিন।"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map(({ icon: Icon, label, labelEn, href, color, bg }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col items-center gap-4 rounded-3xl border border-border bg-card p-6 text-center shadow-sm transition-all hover:border-primary hover:shadow-md active:scale-95"
            >
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${bg} transition-colors group-hover:bg-primary/10`}>
                <Icon className={`h-8 w-8 ${color}`} />
              </div>
              <p className="text-sm font-bold text-foreground group-hover:text-primary">
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

      <section className="bg-primary/5 py-16 border-y border-primary/10" aria-labelledby="trust-features">
        <div className="mx-auto max-w-7xl space-y-12 px-4">
          <div className="space-y-4 text-center max-w-3xl mx-auto">
            <h2 id="trust-features" className="text-3xl font-bold text-foreground sm:text-4xl">
              {isEn ? "Why use our platform?" : "কেন আমাদের প্ল্যাটফর্ম ব্যবহার করবেন?"}
            </h2>
            <p className="text-lg text-muted-foreground">
              {isEn
                ? "We focus on transparency and trust to help you find the right opportunities safely."
                : "আমরা স্বচ্ছতা এবং বিশ্বাসের উপর গুরুত্ব দেই যাতে আপনি নিরাপদভাবে সঠিক সুযোগ খুঁজে পান।"}
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {TRUST_FEATURES.map(({ icon: Icon, title, titleEn, body, bodyEn }) => (
              <div key={title} className="flex flex-col items-center text-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-sm border border-primary/10">
                  <Icon className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-foreground">
                    {isEn ? titleEn : title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {isEn ? bodyEn : body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
