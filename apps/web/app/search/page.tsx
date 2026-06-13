import Link from "next/link";
import { X } from "lucide-react";

import { OpportunityCard } from "@/components/opportunity-card";
import { SearchFilters } from "@/components/search-filters";
import { Card } from "@/components/ui/card";
import { getOpportunityCategories, searchOpportunities } from "@/lib/api";
import {
  ALL_JOBS_OPPORTUNITY_TYPES,
  getISCSectorByKey,
  getISCSectorFromSearchParam,
} from "@/lib/isc-sectors";
import { getLocale, getT } from "@/lib/i18n";
import { fetchBackendJsonWithAuth, getCurrentUser } from "@/lib/server-auth-fetch";
import { cn } from "@/lib/utils";


interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const FILTER_LABELS = {
  q: { bn: "খোঁজ", en: "Search" },
  opportunity_type: { bn: "ধরন", en: "Type" },
  country: { bn: "দেশ", en: "Country" },
  sector: { bn: "ক্যাটাগরি", en: "Category" },
  isc_category_key: { bn: "ক্যাটাগরি", en: "Category" },
  official_sources_only: { bn: "সরকারি উৎস", en: "Official only" },
  can_apply_from_bd: { bn: "বাংলাদেশ থেকে আবেদন", en: "Apply from BD" },
  deadline_within: { bn: "শেষ সময়", en: "Deadline" },
  salary_min: { bn: "বেতন", en: "Salary" },
  bangladesh_applicability: { bn: "বাংলাদেশিদের জন্য উপযুক্ত", en: "Bangladesh suitability" },
  source: { bn: "উৎস", en: "Source" },
  sort: { bn: "সাজানো", en: "Sort" },
} as const;

const SORT_OPTIONS = {
  relevance: { bn: "সবচেয়ে প্রাসঙ্গিক", en: "Most relevant" },
  newest: { bn: "নতুন আগে", en: "Newest first" },
  deadline: { bn: "শেষ তারিখ আগে", en: "Deadline first" },
  trust: { bn: "সবচেয়ে বিশ্বস্ত", en: "Most trusted" },
} as const;

const SORT_SUBMIT_LABEL = {
  bn: "প্রয়োগ",
  en: "Apply",
} as const;

const OPPORTUNITY_TYPE_LABELS: Record<string, { bn: string; en: string }> = {
  [ALL_JOBS_OPPORTUNITY_TYPES]: { bn: "সব চাকরি", en: "All Jobs" },
  overseas_job: { bn: "প্রবাস চাকরি", en: "Overseas Jobs" },
  local_job: { bn: "স্থানীয় চাকরি", en: "Local Jobs" },
  scholarship: { bn: "স্কলারশিপ", en: "Scholarships" },
  migration_policy: { bn: "ভিসা নীতি", en: "Visa Policy" },
};

function getCategoryLabel(
  value: string,
  isEn: boolean,
  categoryLabels: Map<string, { bn: string; en: string }>,
): string | null {
  const category = categoryLabels.get(value);
  if (category) {
    return isEn ? category.en : category.bn;
  }
  const sector = getISCSectorByKey(value);
  if (sector) {
    return isEn ? sector.en : sector.bn;
  }
  return null;
}

function getFilterValueLabel(
  key: string,
  value: string,
  isEn: boolean,
  categoryLabels: Map<string, { bn: string; en: string }>,
): string {
  if (key === "isc_category_key") {
    return getCategoryLabel(value, isEn, categoryLabels) ?? value;
  }

  if (key === "sector") {
    const sector = getISCSectorFromSearchParam(value);
    if (sector) {
      return isEn ? sector.en : sector.bn;
    }
  }

  if (key === "opportunity_type") {
    const label = OPPORTUNITY_TYPE_LABELS[value];
    if (label) {
      return isEn ? label.en : label.bn;
    }
  }

  return value;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const [locale, params, categories] = await Promise.all([
    getLocale(),
    searchParams,
    getOpportunityCategories().catch(() => []),
  ]);
  const isEn = locale === "en";
  const t = await getT("search");
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string" && value.length > 0) {
      query.set(key, value);
    }
  });

  if (!query.has("page")) {
    query.set("page", "1");
  }
  if (!query.has("page_size")) {
    query.set("page_size", "20");
  }

  const user = await getCurrentUser();
  const tab = (query.get("tab") ?? "all") as "all" | "for_me" | "by_country" | "by_work" | "trusted" | "closing_soon";

  let data;
  let isRecommendations = false;

  if (tab === "for_me") {
    if (user) {
      isRecommendations = true;
      const recData = await fetchBackendJsonWithAuth<any>(
        `/api/v1/recommendations?page=${query.get("page") ?? "1"}&page_size=${query.get("page_size") ?? "20"}`
      );
      data = recData ?? { items: [], total: 0, page: 1, page_size: 20 };
    } else {
      data = { items: [], total: 0, page: 1, page_size: 20 };
    }
  } else {
    const activeParams = new URLSearchParams(query);
    if (tab === "trusted") {
      activeParams.set("official_sources_only", "true");
    }
    if (tab === "closing_soon") {
      activeParams.set("deadline_within", "7");
      activeParams.set("sort", "deadline");
    }

    try {
      data = await searchOpportunities(activeParams);
    } catch {
      data = {
        items: [],
        total: 0,
        page: Number(query.get("page") ?? "1"),
        page_size: Number(query.get("page_size") ?? "20"),
      };
    }
  }

  const legacySector = getISCSectorFromSearchParam(query.get("sector"));
  const selectedCategoryKey = query.get("isc_category_key") ?? legacySector?.key ?? "";
  const resolvedOpportunityType =
    query.get("opportunity_type") ?? (selectedCategoryKey ? ALL_JOBS_OPPORTUNITY_TYPES : "");
  const categoryLabels = new Map(
    categories.map((category) => [
      category.key,
      { bn: category.label_bn, en: category.label_en },
    ]),
  );
  const filterEntries = Array.from(query.entries()).filter(([key]) => !["page", "page_size"].includes(key));
  const typeCounts = data.items.reduce(
    (acc: any, item: any) => {
      const type = item.opportunity_type ?? "";
      if (type) {
        acc[type] = (acc[type] ?? 0) + 1;
      }
      if (type === "overseas_job" || type === "local_job") {
        acc.all_jobs += 1;
      }
      return acc;
    },
    {
      all: data.total,
      all_jobs: 0,
      overseas_job: 0,
      local_job: 0,
      scholarship: 0,
      migration_policy: 0,
    } as Record<string, number>,
  );
  const hasFilters = filterEntries.length > 0;

  const CHIPS = [
    { key: "education_level", value: "secondary", bn: "SSC পাসে চাকরি", en: "SSC Pass Jobs" },
    { key: "q", value: "driver", bn: "ড্রাইভিং চাকরি", en: "Driving Jobs" },
    { key: "country", value: "Saudi Arabia", bn: "সৌদি কাজ", en: "Saudi Arabia Jobs" },
    { key: "country", value: "Malaysia", bn: "মালয়েশিয়া কাজ", en: "Malaysia Jobs" },
    { key: "can_apply_from_bd", value: "true", bn: "বাংলাদেশ থেকে আবেদন", en: "Apply from Bangladesh" },
    { key: "deadline_within", value: "30", bn: "শেষ তারিখ আছে", en: "Has Deadline" },
  ] as const;

  const isChipActive = (chip: typeof CHIPS[number]) => {
    const val = query.get(chip.key);
    if (chip.key === "q") {
      return val?.toLowerCase().includes(chip.value) ?? false;
    }
    return val === chip.value;
  };

  const getChipHref = (chip: typeof CHIPS[number], active: boolean) => {
    const params = new URLSearchParams(query);
    params.set("page", "1");
    if (active) {
      params.delete(chip.key);
    } else {
      params.set(chip.key, chip.value);
    }
    const qs = params.toString();
    return `/search${qs ? `?${qs}` : ""}`;
  };

  const TABS = [
    { key: "all", bn: "সব সুযোগ", en: "All Opportunities" },
    { key: "for_me", bn: "আমার জন্য", en: "For me" },
    { key: "by_country", bn: "দেশ অনুযায়ী", en: "By country" },
    { key: "by_work", bn: "কাজ অনুযায়ী", en: "By work type" },
    { key: "trusted", bn: "সরকারি/বিশ্বস্ত", en: "Trusted" },
    { key: "closing_soon", bn: "শেষ তারিখ কাছে", en: "Closing soon" },
  ] as const;

  const activeTab = (() => {
    const tabParam = query.get("tab");
    if (tabParam) return tabParam;
    if (query.get("official_sources_only") === "true") return "trusted";
    if (query.get("deadline_within") === "7") return "closing_soon";
    return "all";
  })();

  const getTabHref = (tabKey: typeof TABS[number]["key"]) => {
    const params = new URLSearchParams(query);
    params.set("page", "1");
    params.delete("tab");
    params.delete("official_sources_only");
    params.delete("deadline_within");

    if (tabKey === "for_me") {
      params.set("tab", "for_me");
    } else if (tabKey === "by_country") {
      params.set("tab", "by_country");
    } else if (tabKey === "by_work") {
      params.set("tab", "by_work");
    } else if (tabKey === "trusted") {
      params.set("official_sources_only", "true");
    } else if (tabKey === "closing_soon") {
      params.set("deadline_within", "7");
      params.set("sort", "deadline");
    }
    const qs = params.toString();
    return `/search${qs ? `?${qs}` : ""}`;
  };

  const countries = [
    { bn: "মালয়েশিয়া", en: "Malaysia", value: "Malaysia" },
    { bn: "সৌদি আরব", en: "Saudi Arabia", value: "Saudi Arabia" },
    { bn: "কাতার", en: "Qatar", value: "Qatar" },
    { bn: "সংযুক্ত আরব আমিরাত", en: "United Arab Emirates", value: "United Arab Emirates" },
    { bn: "কুয়েত", en: "Kuwait", value: "Kuwait" },
    { bn: "ওমান", en: "Oman", value: "Oman" },
    { bn: "কানাডা", en: "Canada", value: "Canada" },
    { bn: "জার্মানি", en: "Germany", value: "Germany" },
  ];

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="max-w-3xl space-y-4">
            <h1 className="text-3xl font-extrabold text-foreground sm:text-4xl lg:text-5xl">
              {t("guidedHeading")}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t("guidedSubtitle")}
            </p>
          </div>

          <div className="mt-6 max-w-2xl">
            <form action="/search" method="GET" className="flex gap-2">
              {Array.from(query.entries())
                .filter(([key]) => key !== "q" && key !== "page")
                .map(([key, value]) => (
                  <input key={`${key}-${value}`} type="hidden" name={key} value={value} />
                ))}
              <div className="relative flex-1">
                <input
                  type="text"
                  name="q"
                  defaultValue={query.get("q") ?? ""}
                  placeholder={isEn ? "Search work, country, education..." : "কাজ, দেশ, পড়াশোনা খুঁজুন..."}
                  className="h-12 w-full rounded-2xl border border-border bg-white px-4 pr-10 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-label={isEn ? "Search input" : "অনুসন্ধান ইনপুট"}
                />
                <button type="submit" className="absolute right-3 top-3.5 text-muted-foreground hover:text-primary" aria-label={isEn ? "Submit search" : "অনুসন্ধান সাবমিট"}>
                  🔍
                </button>
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                {isEn ? "Search" : "খুঁজুন"}
              </button>
            </form>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {CHIPS.map((chip) => {
              const active = isChipActive(chip);
              const href = getChipHref(chip, active);
              return (
                <Link
                  key={chip.bn}
                  href={href as any}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all border shadow-sm",
                    active
                      ? "bg-primary border-primary text-white scale-[1.02]"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:border-primary/50 hover:bg-primary/5"
                  )}
                >
                  {isEn ? chip.en : chip.bn}
                  {active && <span className="text-[10px] ml-0.5">✕</span>}
                </Link>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-2">
              {hasFilters && (
                <>
                  {filterEntries.map(([key, value]) => {
                    const nextParams = new URLSearchParams(query);
                    nextParams.delete(key);
                    const label = FILTER_LABELS[key as keyof typeof FILTER_LABELS];

                    return (
                      <a
                        key={`${key}-${value}`}
                        href={`/search${nextParams.toString() ? `?${nextParams.toString()}` : ""}`}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary"
                      >
                        <span>
                          {label ? (isEn ? label.en : label.bn) : key}: {getFilterValueLabel(key, value, isEn, categoryLabels)}
                        </span>
                        <X className="h-3 w-3" />
                      </a>
                    );
                  })}
                  <Link href="/search" className="text-xs font-bold text-muted-foreground transition-colors hover:text-primary">
                    {isEn ? "Clear all" : "সব মুছুন"}
                  </Link>
                </>
              )}
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-border bg-muted/30 p-1.5">
              <span className="hidden px-2 text-sm font-bold text-muted-foreground sm:inline">
                {isEn ? "Sort by:" : "সাজানো:"}
              </span>
              <form action="/search" className="flex items-center gap-2">
                {filterEntries
                  .filter(([key]) => key !== "sort")
                  .map(([key, value]) => (
                    <input key={`${key}-${value}`} type="hidden" name={key} value={value} />
                  ))}
                <select
                  name="sort"
                  defaultValue={query.get("sort") ?? "relevance"}
                  className="cursor-pointer border-none bg-transparent text-sm font-bold text-foreground focus:ring-0"
                  aria-label={isEn ? "Sort order" : "সাজানোর ক্রম"}
                >
                  <option value="relevance">{isEn ? SORT_OPTIONS.relevance.en : SORT_OPTIONS.relevance.bn}</option>
                  <option value="newest">{isEn ? SORT_OPTIONS.newest.en : SORT_OPTIONS.newest.bn}</option>
                  <option value="deadline">{isEn ? SORT_OPTIONS.deadline.en : SORT_OPTIONS.deadline.bn}</option>
                  <option value="trust">{isEn ? SORT_OPTIONS.trust.en : SORT_OPTIONS.trust.bn}</option>
                </select>
                <button type="submit" className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white">
                  {isEn ? SORT_SUBMIT_LABEL.en : SORT_SUBMIT_LABEL.bn}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <div className="border-b border-border bg-slate-50/50">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex gap-2 overflow-x-auto py-3 scrollbar-none">
            {TABS.map((tabItem) => {
              const active = activeTab === tabItem.key;
              const href = getTabHref(tabItem.key);
              return (
                <Link
                  key={tabItem.key}
                  href={href as any}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-2 text-xs sm:text-sm font-bold transition-all border",
                    active
                      ? "bg-primary border-primary text-white shadow-sm"
                      : "bg-white border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                  )}
                >
                  {isEn ? tabItem.en : tabItem.bn}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <SearchFilters
            isEn={isEn}
            typeCounts={typeCounts}
            categories={categories}
            initialValues={{
              q: query.get("q") ?? "",
              opportunity_type: resolvedOpportunityType,
              country: query.get("country") ?? "",
              isc_category_key: selectedCategoryKey,
              official_sources_only: query.get("official_sources_only") === "true",
              can_apply_from_bd: query.get("can_apply_from_bd") === "true",
              deadline_within: query.get("deadline_within") ?? "",
              salary_min: query.get("salary_min") ?? "",
              lmia_status: query.get("lmia_status") ?? "",
              requires_existing_work_permit: query.get("requires_existing_work_permit") === "true",
              bangladesh_applicability: query.get("bangladesh_applicability") ?? "",
              source: query.get("source") ?? "",
              trust_score_min: query.get("trust_score_min") ?? "",
              education_level: query.get("education_level") ?? "",
              experience_max: query.get("experience_max") ?? "",
              sort: query.get("sort") ?? "relevance",
            }}
          />

          <section className="space-y-4" aria-label={isEn ? "Search results" : "অনুসন্ধান ফলাফল"}>
            {activeTab === "by_country" && (
              <div className="mb-6 rounded-2xl bg-slate-50 p-4 border border-border">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  {isEn ? "Select country:" : "দেশ নির্বাচন করুন:"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {countries.map((c) => {
                    const active = query.get("country") === c.value;
                    const nextParams = new URLSearchParams(query);
                    nextParams.set("page", "1");
                    if (active) nextParams.delete("country");
                    else nextParams.set("country", c.value);
                    const href = `/search${nextParams.toString() ? `?${nextParams.toString()}` : ""}`;

                    return (
                      <Link
                        key={c.value}
                        href={href as any}
                        className={cn(
                          "rounded-full border px-3.5 py-2 text-xs font-bold transition-all",
                          active
                            ? "bg-primary border-primary text-white"
                            : "bg-white border-border text-slate-700 hover:border-primary/50 hover:bg-primary/5"
                        )}
                      >
                        {isEn ? c.en : c.bn}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "by_work" && categories.length > 0 && (
              <div className="mb-6 rounded-2xl bg-slate-50 p-4 border border-border">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  {isEn ? "Select work type:" : "কাজের ধরন নির্বাচন করুন:"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const active = query.get("isc_category_key") === cat.key;
                    const nextParams = new URLSearchParams(query);
                    nextParams.set("page", "1");
                    if (active) {
                      nextParams.delete("isc_category_key");
                    } else {
                      nextParams.set("isc_category_key", cat.key);
                      nextParams.set("opportunity_type", ALL_JOBS_OPPORTUNITY_TYPES);
                    }
                    const href = `/search${nextParams.toString() ? `?${nextParams.toString()}` : ""}`;

                    return (
                      <Link
                        key={cat.key}
                        href={href as any}
                        className={cn(
                          "rounded-full border px-3.5 py-2 text-xs font-bold transition-all",
                          active
                            ? "bg-primary border-primary text-white"
                            : "bg-white border-border text-slate-700 hover:border-primary/50 hover:bg-primary/5"
                        )}
                      >
                        {isEn ? cat.label_en : cat.label_bn} ({cat.job_count})
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === "for_me" && !user ? (
              <Card className="flex flex-col items-center justify-center border-dashed border-2 border-primary/20 bg-primary/5 p-8 text-center rounded-[30px] shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-4xl mb-4">
                  🔑
                </div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  {t("loginCtaTitle")}
                </h2>
                <p className="mt-2 text-sm text-slate-600 max-w-md">
                  {t("loginCtaDesc")}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link
                    href="/auth/login?next=%2Fsearch%3Ftab%3Dfor_me"
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
                  >
                    {t("loginBtn")}
                  </Link>
                  <Link
                    href="/auth/register?next=%2Fsearch%3Ftab%3Dfor_me"
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-border bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {t("registerBtn")}
                  </Link>
                </div>
              </Card>
            ) : data.items.length === 0 ? (
              <Card className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-4xl">
                  🔍
                </div>
                <h2 className="mt-4 text-xl font-bold text-foreground">
                  {isEn ? "No opportunities in this filter" : "এই ফিল্টারে কোনো সুযোগ নেই"}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  {isEn ? "Try another country or category." : "অন্য দেশ বা ক্যাটাগরি চেষ্টা করুন"}
                </p>
                <Link
                  href="/search"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white"
                >
                  <span>{isEn ? "Clear all filters" : "সব ফিল্টার সরান"}</span>
                </Link>
              </Card>
            ) : (
              data.items.map((item: any) => <OpportunityCard key={item.id} item={item} variant="large" showMatchBanner={isRecommendations} />)
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
