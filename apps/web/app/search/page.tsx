import { OpportunityCard } from "@/components/opportunity-card";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { searchOpportunities } from "@/lib/api";

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string" && value.length > 0) {
      query.set(key, value);
    }
  });

  if (!query.has("page")) query.set("page", "1");
  if (!query.has("page_size")) query.set("page_size", "20");

  const data = await searchOpportunities(query);
  const activeFilters = ["country", "city", "sector", "degree_level", "record_type", "trust_tier"]
    .map((key) => [key, query.get(key)] as const)
    .filter(([, value]) => Boolean(value));

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Discovery</p>
            <h1 className="font-display text-4xl font-bold">Search verified opportunities</h1>
            <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              Filter by location, trust, sector, degree level, and visa support to narrow the opportunity set to what is actually useful.
            </p>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">{data.total} records available</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit space-y-4">
          <h2 className="font-display text-xl font-bold">Filters</h2>
          <form action="/search" className="space-y-3">
            <Input name="q" placeholder="Keywords, e.g. warehouse visa jobs" defaultValue={query.get("q") ?? ""} />
            <Input name="semantic_q" placeholder="Intent, e.g. beginner-friendly scholarships" defaultValue={query.get("semantic_q") ?? ""} />
            <Input name="country" placeholder="Country" defaultValue={query.get("country") ?? ""} />
            <Input name="city" placeholder="City" defaultValue={query.get("city") ?? ""} />
            <Input name="sector" placeholder="Sector" defaultValue={query.get("sector") ?? ""} />
            <Input name="degree_level" placeholder="Degree level" defaultValue={query.get("degree_level") ?? ""} />
            <details className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
              <summary className="cursor-pointer font-semibold">Advanced filters</summary>
              <div className="mt-3 space-y-3">
                <Input name="salary_min" type="number" placeholder="Minimum salary" defaultValue={query.get("salary_min") ?? ""} />
                <Input name="salary_max" type="number" placeholder="Maximum salary" defaultValue={query.get("salary_max") ?? ""} />
                <select
                  name="visa_support"
                  defaultValue={query.get("visa_support") ?? ""}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">Visa support (any)</option>
                  <option value="true">Visa support only</option>
                  <option value="false">No visa support</option>
                </select>
                <select
                  name="trust_tier"
                  defaultValue={query.get("trust_tier") ?? ""}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">Trust tier (any)</option>
                  <option value="official_gov">Official gov</option>
                  <option value="official_partner">Official partner</option>
                  <option value="established_portal">Established portal</option>
                  <option value="news_only">News only</option>
                </select>
              </div>
            </details>
            <select
              name="sort"
              defaultValue={query.get("sort") ?? "relevance"}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="relevance">Relevance</option>
              <option value="newest">Newest</option>
              <option value="deadline">Deadline soonest</option>
              <option value="trust">Highest trust</option>
              <option value="salary">Salary high to low</option>
            </select>
            <button className="w-full rounded-xl bg-primary py-2 text-sm font-semibold text-white">Apply</button>
          </form>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">Search results</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">{data.total} records</p>
          </div>
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map(([key, value]) => (
                <span
                  key={key}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900"
                >
                  {key}: {value}
                </span>
              ))}
            </div>
          )}
          {data.items.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-600 dark:text-slate-300">No opportunities found. Try broadening filters.</p>
            </Card>
          ) : (
            data.items.map((item) => <OpportunityCard key={item.id} item={item} />)
          )}
        </div>
      </div>
    </div>
  );
}
