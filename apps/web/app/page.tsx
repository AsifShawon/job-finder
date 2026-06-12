import Link from "next/link";
import { AlertCircle, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

import { HeroSlider } from "@/components/hero-slider";
import { HomeCategoryGrid } from "@/components/home-category-grid";
import { NewsTicker } from "@/components/news-ticker";
import { OpportunityCard } from "@/components/opportunity-card";
import { Card } from "@/components/ui/card";
import { getOpportunityCategories, getQuickAccessItems, searchOpportunities } from "@/lib/api";
import { buildAllJobsHref, getDefaultOpportunityCategories } from "@/lib/isc-sectors";
import { getLocale } from "@/lib/i18n";
import { buildQuickAccessHref, getQuickAccessLabel } from "@/lib/quick-access";

async function getFeaturedOpportunities() {
  try {
    const params = new URLSearchParams({
      page_size: "3",
      sort: "trust",
      opportunity_type: "overseas_job,local_job",
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
      opportunity_type: "overseas_job,local_job",
    });
    return await searchOpportunities(params);
  } catch {
    return { items: [], total: 0, page: 1, page_size: 6 };
  }
}

async function getTickerOpportunities() {
  try {
    const params = new URLSearchParams({
      page_size: "12",
      sort: "newest",
      opportunity_type: "overseas_job,local_job",
    });
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
] as const;

export default async function HomePage() {
  const locale = await getLocale();
  const isEn = locale === "en";
  const [featured, recent, tickerItems, categories, quickAccessItems] = await Promise.all([
    getFeaturedOpportunities(),
    getRecentOpportunities(),
    getTickerOpportunities(),
    getOpportunityCategories()
      .then((items) => (items.length > 0 ? items : getDefaultOpportunityCategories()))
      .catch(() => getDefaultOpportunityCategories()),
    getQuickAccessItems().catch(() => []),
  ]);

  return (
    <main className="space-y-8 bg-background pb-8">
      <HeroSlider />
      <div className="border-y border-border bg-card py-4">
        <NewsTicker items={tickerItems} />
      </div>

      <section className="mx-auto max-w-7xl space-y-8 px-4 py-8" aria-labelledby="home-categories">
        <div className="space-y-3 text-center">
          <h2 id="home-categories" className="text-2xl font-bold text-foreground">
            {isEn ? "Popular paths" : "আপনার জন্য জনপ্রিয় পথ"}
          </h2>
          <p className="text-muted-foreground">
            {isEn
              ? "Choose from the most popular job categories"
              : "সবচেয়ে বেশি চাকরি থাকা ক্যাটাগরিগুলো থেকে বেছে নিন"}
          </p>
        </div>

        <HomeCategoryGrid categories={categories} isEn={isEn} />
      </section>

      {featured.items.length > 0 && (
        <section className="mx-auto max-w-7xl space-y-4 px-4" aria-labelledby="featured-opportunities">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <h2 id="featured-opportunities" className="section-underline text-xl font-bold text-foreground">
                {isEn ? "Trusted opportunities" : "বিশ্বস্ত সুযোগ"}
              </h2>
              <p className="text-muted-foreground">
                {isEn
                  ? "Directly collected from official or high-trust sources"
                  : "সরকারি বা নির্ভরযোগ্য প্রতিষ্ঠান থেকে সরাসরি সংগৃহীত"}
              </p>
            </div>
            <Link href={buildAllJobsHref()} className="text-sm font-semibold text-primary hover:underline">
              {isEn ? "View all" : "সব দেখুন"} â†’
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featured.items.map((item) => (
              <OpportunityCard key={item.id} item={item} variant="compact" />
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
                  {isEn ? "Latest opportunities" : "সর্বশেষ সুযোগ"}
                </h2>
                <p className="text-muted-foreground">
                  {isEn
                    ? "Recently added local and overseas jobs"
                    : "নতুন যুক্ত হওয়া দেশ ও বিদেশের চাকরি"}
                </p>
              </div>
              <Link href="/search?sort=newest" className="text-sm font-semibold text-primary hover:underline">
                {isEn ? "View all" : "সব দেখুন"} â†’
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {recent.items.length === 0 ? (
                <Card className="text-center md:col-span-2">
                  <p className="font-semibold text-foreground">
                    {isEn ? "No opportunities available right now." : "এই মুহূর্তে কোনো সুযোগ পাওয়া যাচ্ছে না।"}
                  </p>
                </Card>
              ) : (
                recent.items.map((item) => <OpportunityCard key={item.id} item={item} variant="compact" />)
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <Card>
              <h3 className="section-underline text-base font-semibold text-foreground">
                {isEn ? "Quick Access" : "দ্রুত অ্যাক্সেস"}
              </h3>
              <div className="mt-4 space-y-1" data-testid="home-quick-access">
                {quickAccessItems.map((item) => (
                  <Link
                    key={`${item.category_key}-${item.country}`}
                    href={buildQuickAccessHref(item.category_key, item.country)}
                    data-testid="quick-access-link"
                    className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted hover:text-primary"
                  >
                    <span>{getQuickAccessLabel(item, isEn)}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            </Card>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold text-foreground">{isEn ? "Sudokkho AI" : "সুদক্ষ AI"}</h3>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {isEn
                  ? "Ask Sudokkho AI to explain a listing, compare countries, or help you prepare next steps."
                  : "সুদক্ষ AI-কে দিয়ে সুযোগ বুঝুন, দেশ তুলনা করুন, আর পরের করণীয় জেনে নিন।"}
              </p>
              <Link
                href="/copilot"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                <span>{isEn ? "Ask Sudokkho AI" : "সুদক্ষ AI-কে জিজ্ঞেস করুন"}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-y border-primary/10 bg-primary/5 py-16" aria-labelledby="trust-features">
        <div className="mx-auto max-w-7xl space-y-12 px-4">
          <div className="mx-auto max-w-3xl space-y-4 text-center">
            <h2 id="trust-features" className="text-3xl font-bold text-foreground sm:text-4xl">
              {isEn ? "Why use Sudokkho?" : "কেন সুদক্ষ ব্যবহার করবেন?"}
            </h2>
            <p className="text-lg text-muted-foreground">
              {isEn
                ? "We help you find the right and safe jobs securely"
                : "আমরা আপনাকে সঠিক ও নিরাপদ চাকরি খুঁজে পেতে সাহায্য করি"}
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {TRUST_FEATURES.map(({ icon: Icon, title, titleEn, body, bodyEn }) => (
              <div key={titleEn} className="flex flex-col items-center space-y-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-primary/10 bg-white shadow-sm">
                  <Icon className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-foreground">{isEn ? titleEn : title}</h3>
                  <p className="leading-relaxed text-muted-foreground">{isEn ? bodyEn : body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
