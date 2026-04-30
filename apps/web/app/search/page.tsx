import Link from "next/link";
import { Search, X } from "lucide-react";

import { OpportunityCard } from "@/components/opportunity-card";
import { SearchFilters } from "@/components/search-filters";
import { Card } from "@/components/ui/card";
import { searchOpportunities } from "@/lib/api";
import { getLocale } from "@/lib/i18n";

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const FILTER_LABELS = {
  q: { bn: "খোঁজ", en: "Search" },
  opportunity_type: { bn: "ধরন", en: "Type" },
  country: { bn: "দেশ", en: "Country" },
  official_sources_only: { bn: "সরকারি উৎস", en: "Official only" },
  can_apply_from_bd: { bn: "বাংলাদেশ থেকে আবেদন", en: "Apply from BD" },
  deadline_within: { bn: "শেষ সময়", en: "Deadline" },
  salary_min: { bn: "বেতন", en: "Salary" },
  sort: { bn: "সাজানো", en: "Sort" },
} as const;

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
  const filterEntries = Array.from(query.entries()).filter(
    ([key]) => !["page", "page_size"].includes(key),
  );

  return (
    <main className="bg-background">
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-primary">
              {isEn ? "Opportunity Search" : "সুযোগ অনুসন্ধান"}
            </p>
            <h1 className="text-3xl font-bold text-foreground">
              {isEn ? "Find Verified Opportunities" : "যাচাইকৃত সুযোগ খুঁজুন"}
            </h1>
            <p className="text-muted-foreground">
              {isEn
                ? "Use simple filters to compare overseas jobs, scholarships, and visa updates."
                : "সহজ ফিল্টার ব্যবহার করে প্রবাস চাকরি, স্কলারশিপ, আর ভিসা আপডেট তুলনা করুন।"}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-semibold text-foreground">
              {isEn ? `${data.total} opportunities found` : `${data.total}টি সুযোগ পাওয়া গেছে`}
            </p>

            <form action="/search" className="flex items-center gap-2">
              {filterEntries
                .filter(([key]) => key !== "sort")
                .map(([key, value]) => (
                  <input key={`${key}-${value}`} type="hidden" name={key} value={value} />
                ))}
              <label className="text-sm font-semibold text-muted-foreground">
                {isEn ? "Sort" : "সাজান"}
              </label>
              <select
                name="sort"
                defaultValue={query.get("sort") ?? "relevance"}
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground"
              >
                <option value="relevance">{isEn ? "Most relevant" : "সবচেয়ে প্রাসঙ্গিক"}</option>
                <option value="newest">{isEn ? "Newest first" : "নতুন আগে"}</option>
                <option value="deadline">{isEn ? "Deadline first" : "শেষ তারিখ আগে"}</option>
                <option value="trust">{isEn ? "Most trusted" : "সবচেয়ে বিশ্বস্ত"}</option>
              </select>
              <button
                type="submit"
                className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white"
              >
                {isEn ? "Update" : "প্রয়োগ"}
              </button>
            </form>
          </div>

          {filterEntries.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {filterEntries.map(([key, value]) => {
                const nextParams = new URLSearchParams(query);
                nextParams.delete(key);
                const label = FILTER_LABELS[key as keyof typeof FILTER_LABELS];

                return (
                  <a
                    key={`${key}-${value}`}
                    href={`/search${nextParams.toString() ? `?${nextParams.toString()}` : ""}`}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                  >
                    <span>{label ? (isEn ? label.en : label.bn) : key}: {value}</span>
                    <X className="h-3 w-3" />
                  </a>
                );
              })}
              <Link
                href="/search"
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground"
              >
                <X className="h-3 w-3" />
                <span>{isEn ? "Clear all" : "সব মুছুন"}</span>
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <SearchFilters
            isEn={isEn}
            initialValues={{
              q: query.get("q") ?? "",
              opportunity_type: query.get("opportunity_type") ?? "",
              country: query.get("country") ?? "",
              isc_sector: query.get("isc_sector") ?? "",
              official_sources_only: query.get("official_sources_only") === "true",
              can_apply_from_bd: query.get("can_apply_from_bd") === "true",
              deadline_within: query.get("deadline_within") ?? "",
              salary_min: query.get("salary_min") ?? "",
              lmia_status: query.get("lmia_status") ?? "",
              requires_existing_work_permit: query.get("requires_existing_work_permit") === "true",
              sort: query.get("sort") ?? "relevance",
            }}
          />

          <section className="space-y-4" aria-label={isEn ? "Search results" : "অনুসন্ধান ফলাফল"}>
            {data.items.length === 0 ? (
              <Card className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Search className="h-7 w-7 text-muted-foreground" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-foreground">
                  {isEn ? "No matching opportunities found" : "মিলে এমন কোনো সুযোগ পাওয়া যায়নি"}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  {isEn
                    ? "Try broader keywords, remove a filter, or start from the most trusted listings."
                    : "আরও সাধারণ শব্দ ব্যবহার করুন, একটি ফিল্টার সরান, অথবা বিশ্বস্ত তালিকা দিয়ে শুরু করুন।"}
                </p>
                <Link
                  href="/search"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white"
                >
                  <span>{isEn ? "See all opportunities" : "সব সুযোগ দেখুন"}</span>
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
