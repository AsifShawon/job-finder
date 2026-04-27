import { Filter, Search, SlidersHorizontal, X } from "lucide-react";

import { OpportunityCard } from "@/components/opportunity-card";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { searchOpportunities } from "@/lib/api";
import { getLocale } from "@/lib/i18n";

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const RECORD_TYPES = [
  { value: "job", label: "প্রবাস চাকরি", en: "Foreign Jobs" },
  { value: "scholarship", label: "স্কলারশিপ", en: "Scholarships" },
  { value: "policy_update", label: "ভিসা নীতি", en: "Visa Policy" },
];

const TRUST_TIERS = [
  { value: "official_gov", label: "সরকারি উৎস", en: "Government" },
  { value: "official_partner", label: "অফিসিয়াল উৎস", en: "Official Partner" },
  { value: "established_portal", label: "প্রতিষ্ঠিত পোর্টাল", en: "Portal" },
  { value: "news_only", label: "সংবাদভিত্তিক", en: "News" },
];

const SORT_OPTIONS = [
  { value: "relevance", label: "প্রাসঙ্গিকতা অনুযায়ী" },
  { value: "newest", label: "নতুন আগে" },
  { value: "deadline", label: "শেষ তারিখ নিকটে" },
  { value: "trust", label: "বিশ্বস্ত উৎস আগে" },
  { value: "salary", label: "বেতন বেশি থেকে কম" },
];

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const [locale, params] = await Promise.all([getLocale(), searchParams]);
  const isEn = locale === "en";

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string" && value.length > 0) query.set(key, value);
  });
  if (!query.has("page")) query.set("page", "1");
  if (!query.has("page_size")) query.set("page_size", "20");

  const data = await searchOpportunities(query);

  const FILTER_KEYS = [
    "country", "city", "sector", "degree_level", "record_type", "trust_tier",
    "can_apply_from_bd", "open_to_international_candidates", "official_sources_only",
    "lmia_status", "opportunity_type",
  ];
  const activeFilters = FILTER_KEYS.map((k) => [k, query.get(k)] as const).filter(([, v]) => Boolean(v));

  const filterLabels: Record<string, string> = {
    country: isEn ? "Country" : "দেশ",
    city: isEn ? "City" : "শহর",
    sector: isEn ? "Sector" : "সেক্টর",
    degree_level: isEn ? "Education" : "শিক্ষা",
    record_type: isEn ? "Type" : "ধরন",
    trust_tier: isEn ? "Trust" : "বিশ্বাসযোগ্যতা",
    can_apply_from_bd: isEn ? "BD applicants" : "বাংলাদেশ থেকে",
    open_to_international_candidates: isEn ? "International" : "আন্তর্জাতিক",
    official_sources_only: isEn ? "Official only" : "শুধু অফিসিয়াল",
    lmia_status: isEn ? "LMIA" : "LMIA",
    opportunity_type: isEn ? "Opp. type" : "সুযোগের ধরন",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Search header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                {isEn ? "Opportunity Search" : "সুযোগ অনুসন্ধান"}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-foreground">
                {isEn ? "Find Verified Opportunities" : "যাচাইকৃত সুযোগ খুঁজুন"}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {isEn ? `${data.total} records found` : `${data.total}টি সুযোগ পাওয়া গেছে`}
            </p>
          </div>

          {/* Active filter pills */}
          {activeFilters.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeFilters.map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                >
                  {filterLabels[key]}: {value}
                </span>
              ))}
              <a
                href="/search"
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <X className="h-3 w-3" />
                {isEn ? "Clear all" : "সব মুছুন"}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Filter sidebar */}
          <aside>
            <Card className="sticky top-[120px]">
              <div className="mb-4 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <h2 className="font-bold text-foreground">
                  {isEn ? "Filters" : "ফিল্টার"}
                </h2>
              </div>

              <form action="/search" className="space-y-4">
                {/* Keyword */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                    {isEn ? "Keyword" : "কীওয়ার্ড"}
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      name="q"
                      placeholder={isEn ? "e.g. warehouse, driver" : "যেমন: ওয়েলডার, ড্রাইভার"}
                      defaultValue={query.get("q") ?? ""}
                      className="pl-8"
                    />
                  </div>
                </div>

                {/* Semantic intent */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                    {isEn ? "Intent / Concept" : "উদ্দেশ্য"}
                  </label>
                  <Input
                    name="semantic_q"
                    placeholder={isEn ? "e.g. scholarship for beginners" : "যেমন: নতুনদের জন্য বৃত্তি"}
                    defaultValue={query.get("semantic_q") ?? ""}
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    {isEn ? "Category" : "ক্যাটাগরি"}
                  </label>
                  <div className="space-y-1">
                    {RECORD_TYPES.map(({ value, label }) => (
                      <label key={value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors">
                        <input
                          type="radio"
                          name="record_type"
                          value={value}
                          defaultChecked={query.get("record_type") === value}
                          className="accent-primary"
                        />
                        <span className="text-sm text-foreground">{label}</span>
                      </label>
                    ))}
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors">
                      <input
                        type="radio"
                        name="record_type"
                        value=""
                        defaultChecked={!query.get("record_type")}
                        className="accent-primary"
                      />
                      <span className="text-sm text-muted-foreground">
                        {isEn ? "All types" : "সব ধরন"}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Country */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                    {isEn ? "Country" : "দেশ"}
                  </label>
                  <Input
                    name="country"
                    placeholder={isEn ? "e.g. Canada, Germany" : "যেমন: কানাডা, জার্মানি"}
                    defaultValue={query.get("country") ?? ""}
                  />
                </div>

                {/* Trust tier */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    {isEn ? "Source trust" : "উৎসের বিশ্বাসযোগ্যতা"}
                  </label>
                  <select
                    name="trust_tier"
                    defaultValue={query.get("trust_tier") ?? ""}
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">{isEn ? "Any trust level" : "যেকোনো স্তর"}</option>
                    {TRUST_TIERS.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Eligibility quick filters */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    {isEn ? "Eligibility" : "যোগ্যতা"}
                  </label>
                  <div className="space-y-1.5">
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors">
                      <input
                        type="checkbox"
                        name="can_apply_from_bd"
                        value="true"
                        defaultChecked={query.get("can_apply_from_bd") === "true"}
                        className="accent-primary"
                      />
                      <span className="text-sm text-foreground">{isEn ? "BD applicants" : "বাংলাদেশ থেকে আবেদনযোগ্য"}</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors">
                      <input
                        type="checkbox"
                        name="open_to_international_candidates"
                        value="true"
                        defaultChecked={query.get("open_to_international_candidates") === "true"}
                        className="accent-primary"
                      />
                      <span className="text-sm text-foreground">{isEn ? "International candidates" : "আন্তর্জাতিক প্রার্থী"}</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors">
                      <input
                        type="checkbox"
                        name="official_sources_only"
                        value="true"
                        defaultChecked={query.get("official_sources_only") === "true"}
                        className="accent-primary"
                      />
                      <span className="text-sm text-foreground">{isEn ? "Official sources only" : "শুধু সরকারি/অফিসিয়াল উৎস"}</span>
                    </label>
                  </div>
                </div>

                {/* LMIA filter */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                    {isEn ? "LMIA Status" : "LMIA স্ট্যাটাস"}
                  </label>
                  <select
                    name="lmia_status"
                    defaultValue={query.get("lmia_status") ?? ""}
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="">{isEn ? "Any" : "যেকোনো"}</option>
                    <option value="none">{isEn ? "No LMIA" : "LMIA নেই"}</option>
                    <option value="requested">{isEn ? "LMIA requested" : "LMIA আবেদিত"}</option>
                    <option value="approved">{isEn ? "LMIA approved" : "LMIA অনুমোদিত"}</option>
                  </select>
                </div>

                {/* Advanced */}
                <details className="rounded-md border border-border p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-foreground">
                    {isEn ? "Advanced filters" : "উন্নত ফিল্টার"}
                  </summary>
                  <div className="mt-3 space-y-3">
                    <Input
                      name="sector"
                      placeholder={isEn ? "Sector" : "সেক্টর"}
                      defaultValue={query.get("sector") ?? ""}
                    />
                    <Input
                      name="degree_level"
                      placeholder={isEn ? "Education level" : "শিক্ষাগত যোগ্যতা"}
                      defaultValue={query.get("degree_level") ?? ""}
                    />
                    <Input
                      name="salary_min"
                      type="number"
                      placeholder={isEn ? "Min salary" : "সর্বনিম্ন বেতন"}
                      defaultValue={query.get("salary_min") ?? ""}
                    />
                    <select
                      name="visa_support"
                      defaultValue={query.get("visa_support") ?? ""}
                      className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                    >
                      <option value="">{isEn ? "Visa support (any)" : "ভিসা সহায়তা (যেকোনো)"}</option>
                      <option value="true">{isEn ? "With visa support" : "ভিসা সহায়তা আছে"}</option>
                      <option value="false">{isEn ? "No visa support" : "ভিসা সহায়তা নেই"}</option>
                    </select>
                  </div>
                </details>

                {/* Sort */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                    {isEn ? "Sort by" : "সাজান"}
                  </label>
                  <select
                    name="sort"
                    defaultValue={query.get("sort") ?? "relevance"}
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    {SORT_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <Filter className="h-4 w-4" />
                  {isEn ? "Apply filters" : "ফিল্টার প্রয়োগ করুন"}
                </button>
              </form>
            </Card>
          </aside>

          {/* Results */}
          <div className="space-y-4">
            {data.items.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-10 text-center">
                <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="font-semibold text-foreground">
                  {isEn ? "No opportunities found" : "কোনো সুযোগ পাওয়া যায়নি"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isEn
                    ? "Try broadening your filters or using different keywords."
                    : "ফিল্টার একটু বিস্তৃত করুন বা ভিন্ন কীওয়ার্ড ব্যবহার করুন।"}
                </p>
                <a
                  href="/search"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  {isEn ? "Clear filters" : "ফিল্টার মুছুন"}
                </a>
              </div>
            ) : (
              data.items.map((item) => (
                <OpportunityCard key={item.id} item={item} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
