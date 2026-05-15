import Link from "next/link";
import { X } from "lucide-react";

import { OpportunityCard } from "@/components/opportunity-card";
import { SearchFilters } from "@/components/search-filters";
import { Card } from "@/components/ui/card";
import { searchOpportunities } from "@/lib/api";
import { getISCSectorFromSearchParam } from "@/lib/isc-sectors";
import { getLocale } from "@/lib/i18n";

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const FILTER_LABELS = {
  q: { bn: "খোঁজ", en: "Search" },
  opportunity_type: { bn: "ধরন", en: "Type" },
  country: { bn: "দেশ", en: "Country" },
  sector: { bn: "ক্যাটাগরি", en: "Category" },
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

function getFilterValueLabel(key: string, value: string, isEn: boolean): string {
  if (key === "sector") {
    const sector = getISCSectorFromSearchParam(value);
    if (sector) {
      return isEn ? sector.en : sector.bn;
    }
  }

  return value;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const [locale, params] = await Promise.all([getLocale(), searchParams]);
  const isEn = locale === "en";
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

  const data = await (async () => {
    try {
      return await searchOpportunities(query);
    } catch {
      return {
        items: [],
        total: 0,
        page: Number(query.get("page") ?? "1"),
        page_size: Number(query.get("page_size") ?? "20"),
      };
    }
  })();

  const filterEntries = Array.from(query.entries()).filter(([key]) => !["page", "page_size"].includes(key));
  const selectedSector = getISCSectorFromSearchParam(query.get("sector")) ?? getISCSectorFromSearchParam(query.get("isc_sector"));
  const typeCounts = data.items.reduce(
    (acc, item) => {
      const type = item.opportunity_type ?? "";
      if (type) {
        acc[type] = (acc[type] ?? 0) + 1;
      }
      return acc;
    },
    {
      all: data.total,
      overseas_job: 0,
      scholarship: 0,
      migration_policy: 0,
    } as Record<string, number>,
  );
  const hasFilters = filterEntries.length > 0;

  return (
    <main className="bg-background min-h-screen">
      <section className="bg-white border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="max-w-3xl space-y-4">
            <h1 className="text-3xl font-extrabold text-foreground sm:text-4xl lg:text-5xl">
              {isEn ? "Explore Opportunities" : "সুযোগগুলো দেখুন"}
            </h1>
            <p className="text-lg text-muted-foreground">
              {isEn
                ? "Compare verified overseas jobs, scholarships, and official visa updates in one place."
                : "প্রবাস চাকরি, স্কলারশিপ এবং সরকারি ভিসা আপডেটগুলো এক জায়গায় সহজে তুলনা করুন।"}
            </p>
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
                          {label ? (isEn ? label.en : label.bn) : key}: {getFilterValueLabel(key, value, isEn)}
                        </span>
                        <X className="h-3 w-3" />
                      </a>
                    );
                  })}
                  <Link
                    href="/search"
                    className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
                  >
                    {isEn ? "Clear all" : "সব মুছুন"}
                  </Link>
                </>
              )}
            </div>

            <div className="flex items-center gap-4 bg-muted/30 p-1.5 rounded-2xl border border-border">
              <span className="hidden sm:inline text-sm font-bold text-muted-foreground px-2">
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
                  className="bg-transparent border-none focus:ring-0 text-sm font-bold text-foreground cursor-pointer"
                >
                  <option value="relevance">{isEn ? SORT_OPTIONS.relevance.en : SORT_OPTIONS.relevance.bn}</option>
                  <option value="newest">{isEn ? SORT_OPTIONS.newest.en : SORT_OPTIONS.newest.bn}</option>
                  <option value="deadline">{isEn ? SORT_OPTIONS.deadline.en : SORT_OPTIONS.deadline.bn}</option>
                  <option value="trust">{isEn ? SORT_OPTIONS.trust.en : SORT_OPTIONS.trust.bn}</option>
	                </select>
	                <button
	                  type="submit"
	                  className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white"
	                >
	                  {isEn ? SORT_SUBMIT_LABEL.en : SORT_SUBMIT_LABEL.bn}
	                </button>
	              </form>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <SearchFilters
            isEn={isEn}
            typeCounts={typeCounts}
            initialValues={{
              q: query.get("q") ?? "",
              opportunity_type: query.get("opportunity_type") ?? "",
              country: query.get("country") ?? "",
              isc_sector: selectedSector?.key ?? "",
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
            {data.items.length === 0 ? (
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
                  aria-label={isEn ? "Clear all filters" : "সব ফিল্টার সরান"}
                >
                  <span>{isEn ? "Clear all filters" : "সব ফিল্টার সরান"}</span>
                </Link>
              </Card>
            ) : (
              data.items.map((item) => <OpportunityCard key={item.id} item={item} />)
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
