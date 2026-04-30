import { Filter, Search, SlidersHorizontal, X } from "lucide-react";

import { OpportunityCard } from "@/components/opportunity-card";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { searchOpportunities } from "@/lib/api";
import { getLocale } from "@/lib/i18n";

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const CATS = [
  { label: "সব", en: "All", value: "" },
  { label: "প্রবাস চাকরি", en: "প্রবাস চাকরি", value: "overseas_job" },
  { label: "স্কলারশিপ", en: "স্কলারশিপ", value: "scholarship" },
  { label: "ভিসা নীতি", en: "ভিসা নীতি", value: "migration_policy" },
];

const SORT_OPTIONS = [
  { value: "relevance", label: "সবচেয়ে প্রাসঙ্গিক", en: "সবচেয়ে প্রাসঙ্গিক" },
  { value: "newest",    label: "নতুন সুযোগ আগে",     en: "নতুন সুযোগ আগে" },
  { value: "deadline",  label: "শেষ তারিখ কাছের",    en: "শেষ তারিখ কাছের" },
  { value: "trust",     label: "সবচেয়ে বিশ্বস্ত উৎস", en: "সবচেয়ে বিশ্বস্ত উৎস" },
  { value: "salary",    label: "বেশি বেতন আগে",       en: "বেশি বেতন আগে" },
];

const DEADLINE_OPTIONS = [
  { value: "", label: "যেকোনো সময়", en: "যেকোনো সময়" },
  { value: "7",  label: "এই সপ্তাহে", en: "এই সপ্তাহে" },
  { value: "30", label: "এই মাসে",   en: "এই মাসে" },
];

const ISC_SECTORS = [
  { key: "informal_isc",       bn: "ইনফরমাল সেক্টর আইএসসি",                   terms: "general,labor,helper,driver,cleaner,domestic,security" },
  { key: "ict_isc",            bn: "আইসিটি আইএসসি",                            terms: "IT,software,developer,tech,digital,programmer,network" },
  { key: "agrofood_isc",       bn: "অ্যাগ্রোফুড আইএসসি",                       terms: "food processing,agriculture,farm,fishery,food,dairy" },
  { key: "jute_isc",           bn: "জুট সেক্টর আইএসসি",                        terms: "jute,fiber,yarn" },
  { key: "ceramic_isc",        bn: "সিরামিক আইএসসি",                           terms: "ceramic,tile,pottery,glass" },
  { key: "leather_isc",        bn: "লেদার ও লেদার গুডস আইএসসি",              terms: "leather,footwear,tannery,shoe" },
  { key: "light_eng_isc",      bn: "লাইট ইঞ্জিনিয়ারিং আইএসসি",              terms: "engineering,mechanic,lathe,machinist,fitter,welder" },
  { key: "rgt_isc",            bn: "রেডিমেড গার্মেন্টস ও টেক্সটাইল আইএসসি", terms: "garments,textile,sewing,fabric,apparel,tailoring" },
  { key: "pharma_isc",         bn: "ফার্মাসিউটিক্যাল আইএসসি",                 terms: "pharmaceutical,medicine,laboratory,pharmacy,medical" },
  { key: "furniture_isc",      bn: "ফার্নিচার আইএসসি",                         terms: "furniture,carpentry,wood,cabinet" },
  { key: "plastics_isc",       bn: "প্লাস্টিকস আইএসসি",                        terms: "plastic,polymer,molding,packaging" },
  { key: "tourism_isc",        bn: "ট্যুরিজম ও হসপিটালিটি আইএসসি",           terms: "hotel,hospitality,restaurant,tourism,cook,waiter,chef" },
  { key: "creative_media_isc", bn: "ক্রিয়েটিভ মিডিয়া আইএসসি",              terms: "media,graphic,video,design,creative,photography" },
  { key: "construction_isc",   bn: "কনস্ট্রাকশন আইএসসি",                       terms: "construction,civil,mason,welder,carpenter,plumber,electrician" },
  { key: "agriculture_isc",    bn: "এগ্রিকালচার আইএসসি",                       terms: "agriculture,farming,crop,livestock,poultry" },
];

const PRIMARY_FILTER_KEYS = [
  "q", "opportunity_type", "country", "isc_sector",
  "official_sources_only", "can_apply_from_bd",
];
const ALL_FILTER_KEYS = [
  ...PRIMARY_FILTER_KEYS,
  "salary_min", "deadline_within", "lmia_status", "requires_existing_work_permit",
];

const filterLabels: Record<string, string> = {
  q: "কীওয়ার্ড",
  opportunity_type: "ক্যাটাগরি",
  country: "দেশ",
  isc_sector: "সেক্টর",
  official_sources_only: "শুধু অফিসিয়াল",
  can_apply_from_bd: "বাংলাদেশ থেকে",
  deadline_within: "আবেদন সময়সীমা",
  salary_min: "সর্বনিম্ন বেতন",
  lmia_status: "LMIA",
  requires_existing_work_permit: "ওয়ার্ক পারমিট",
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const [locale, params] = await Promise.all([getLocale(), searchParams]);
  const isEn = locale === "en";

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string" && value.length > 0) query.set(key, value);
  });
  if (!query.has("page")) query.set("page", "1");
  if (!query.has("page_size")) query.set("page_size", "20");

  // Convert isc_sector key to sector terms for backend
  const iscSectorKey = query.get("isc_sector") ?? "";
  const iscSectorTerms = ISC_SECTORS.find((s) => s.key === iscSectorKey)?.terms ?? "";
  if (iscSectorTerms && !query.has("sector")) {
    query.set("sector", iscSectorTerms);
  }

  const data = await searchOpportunities(query);

  const activeFilters = ALL_FILTER_KEYS
    .map((k) => [k, query.get(k)] as const)
    .filter(([k, v]) => Boolean(v) && k !== "sector"); // hide raw sector, show isc_sector label

  const selectedCat = query.get("opportunity_type") ?? "";
  const selectedIsc = query.get("isc_sector") ?? "";
  const hasMoreFilters = ["salary_min", "deadline_within", "lmia_status", "requires_existing_work_permit"]
    .some((k) => Boolean(query.get(k)));

  const iscLabel = ISC_SECTORS.find((s) => s.key === selectedIsc)?.bn ?? selectedIsc;

  // Build URL without isc_sector for the remove pill link
  const withoutIsc = new URLSearchParams(params as Record<string, string>);
  withoutIsc.delete("isc_sector");
  withoutIsc.delete("sector");

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

          {/* Active filter pills + ISC sector removable pill */}
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedIsc && (
              <span className="inline-flex items-center gap-1 rounded-full border border-teal-300 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                {iscLabel}
                <a
                  href={`/search?${withoutIsc.toString()}`}
                  aria-label="সেক্টর ফিল্টার সরান"
                  className="ml-1 text-teal-500 hover:text-teal-700"
                >
                  <X className="h-3 w-3" />
                </a>
              </span>
            )}
            {activeFilters
              .filter(([k]) => k !== "isc_sector")
              .map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                >
                  {filterLabels[key]}: {value}
                </span>
              ))}
            {(activeFilters.length > 0 || selectedIsc) && (
              <a
                href="/search"
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <X className="h-3 w-3" />
                {isEn ? "Clear all" : "সব মুছুন"}
              </a>
            )}
          </div>
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

                {/* ISC Sector dropdown */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                    {isEn ? "ISC Sector" : "সেক্টর বেছে নিন"}
                  </label>
                  <select
                    name="isc_sector"
                    defaultValue={selectedIsc}
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">{isEn ? "All sectors" : "সব সেক্টর"}</option>
                    {ISC_SECTORS.map((s) => (
                      <option key={s.key} value={s.key}>{s.bn}</option>
                    ))}
                  </select>
                </div>

                {/* Opportunity type pills */}
                <div>
                  <label className="mb-2 block text-xs font-semibold text-muted-foreground">
                    {isEn ? "Type" : "ধরন"}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {CATS.map(({ value, label }) => (
                      <label key={value} className="cursor-pointer">
                        <input
                          type="radio"
                          name="opportunity_type"
                          value={value}
                          defaultChecked={selectedCat === value}
                          className="sr-only"
                        />
                        <span
                          className={
                            selectedCat === value
                              ? "inline-flex rounded-full border border-primary bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                              : "inline-flex rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
                          }
                        >
                          {label}
                        </span>
                      </label>
                    ))}
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

                {/* Quick eligibility toggles */}
                <div className="space-y-1.5">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors">
                    <input
                      type="checkbox"
                      name="can_apply_from_bd"
                      value="true"
                      defaultChecked={query.get("can_apply_from_bd") === "true"}
                      className="accent-primary"
                    />
                    <span className="text-sm text-foreground">
                      {isEn ? "Open to BD applicants" : "বাংলাদেশ থেকে আবেদনযোগ্য"}
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors">
                    <input
                      type="checkbox"
                      name="official_sources_only"
                      value="true"
                      defaultChecked={query.get("official_sources_only") === "true"}
                      className="accent-primary"
                    />
                    <span className="text-sm text-foreground">
                      {isEn ? "Official/Govt sources only" : "সরকারি/অফিসিয়াল উৎস"}
                    </span>
                  </label>
                </div>

                {/* More filters */}
                <details className="rounded-md border border-border p-3" open={hasMoreFilters}>
                  <summary className="cursor-pointer text-sm font-semibold text-foreground">
                    {isEn ? "More filters" : "আরো ফিল্টার"}
                  </summary>
                  <div className="mt-3 space-y-3">
                    {/* Deadline */}
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                        {isEn ? "Deadline" : "আবেদন সময়সীমা"}
                      </label>
                      <select
                        name="deadline_within"
                        defaultValue={query.get("deadline_within") ?? ""}
                        className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                      >
                        {DEADLINE_OPTIONS.map(({ value, label }) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Salary min */}
                    <Input
                      name="salary_min"
                      type="number"
                      placeholder={isEn ? "Min salary" : "সর্বনিম্ন বেতন"}
                      defaultValue={query.get("salary_min") ?? ""}
                    />

                    {/* LMIA status */}
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                        LMIA
                      </label>
                      <select
                        name="lmia_status"
                        defaultValue={query.get("lmia_status") ?? ""}
                        className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                      >
                        <option value="">{isEn ? "Any" : "যেকোনো"}</option>
                        <option value="approved">{isEn ? "LMIA approved" : "LMIA আছে"}</option>
                        <option value="none">{isEn ? "No LMIA" : "LMIA ছাড়া"}</option>
                      </select>
                    </div>

                    {/* Work permit */}
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors">
                      <input
                        type="checkbox"
                        name="requires_existing_work_permit"
                        value="false"
                        defaultChecked={query.get("requires_existing_work_permit") === "false"}
                        className="accent-primary"
                      />
                      <span className="text-sm text-foreground">
                        {isEn ? "No work permit required" : "ওয়ার্ক পারমিট ছাড়া আবেদন"}
                      </span>
                    </label>
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
