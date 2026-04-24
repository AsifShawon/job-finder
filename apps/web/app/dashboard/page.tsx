import Link from "next/link";

import { OpportunityCard } from "@/components/opportunity-card";
import { Card } from "@/components/ui/card";
import { searchOpportunities } from "@/lib/api";
import { fetchBackendJsonWithAuth, requireCurrentUser } from "@/lib/server-auth-fetch";
import type { AlertRulePage, OpportunityCard as OpportunityCardType } from "@/lib/types";

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const savedItems =
    (await fetchBackendJsonWithAuth<OpportunityCardType[]>("/api/v1/saved")) ??
    [];
  const alertPage =
    (await fetchBackendJsonWithAuth<AlertRulePage>("/api/v1/alerts")) ??
    { items: [], total: 0, page: 1, page_size: 20 };

  const query = new URLSearchParams({
    sort: "newest",
    page: "1",
    page_size: "4",
  });
  const latest = await searchOpportunities(query);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-slate-200 bg-white/85 p-8 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Member dashboard</p>
            <h1 className="font-display text-4xl font-bold tracking-tight">
              Welcome back, {user.full_name.split(" ")[0]}.
            </h1>
            <p className="max-w-2xl text-slate-600 dark:text-slate-300">
              Track new opportunities, keep your saved shortlist current, and stay ahead of new crawl results from trusted sources.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/search" className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white">
                Browse opportunities
              </Link>
              <Link href="/alerts" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold dark:border-slate-700">
                Manage alerts
              </Link>
              {user.is_admin ? (
                <Link href="/admin" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold dark:border-slate-700">
                  Open admin
                </Link>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Card className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Saved shortlist</p>
              <p className="font-display text-3xl font-bold">{savedItems.length}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">Items you can revisit quickly.</p>
            </Card>
            <Card className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Active alerts</p>
              <p className="font-display text-3xl font-bold">{alertPage.items.filter((item) => item.is_active).length}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">Queries monitored by worker and beat.</p>
            </Card>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">Saved opportunities</h2>
            <Link href="/saved" className="text-sm font-semibold text-primary">
              View all
            </Link>
          </div>
          {savedItems.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                You have not saved anything yet. Start from search results and build a shortlist you can compare.
              </p>
            </Card>
          ) : (
            savedItems.slice(0, 3).map((item) => <OpportunityCard key={item.id} item={item} />)
          )}
        </div>

        <div className="space-y-4">
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">Alert rules</h2>
              <Link href="/alerts" className="text-sm font-semibold text-primary">
                Edit
              </Link>
            </div>
            {alertPage.items.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                No alerts configured. Create one to track roles, countries, or scholarship terms automatically.
              </p>
            ) : (
              <div className="space-y-3">
                {alertPage.items.slice(0, 4).map((alert) => (
                  <div key={alert.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{alert.name}</p>
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {alert.is_active ? "Active" : "Paused"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{alert.query_text}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">Fresh opportunities</h2>
              <Link href="/search?sort=newest" className="text-sm font-semibold text-primary">
                See more
              </Link>
            </div>
            <div className="space-y-3">
              {latest.items.slice(0, 4).map((item) => (
                <Link key={item.id} href={`/opportunity/${item.id}`} className="block rounded-2xl border border-slate-200 p-4 transition-colors hover:border-primary dark:border-slate-800">
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {item.employer ?? item.organization ?? "Unknown organization"} | {item.country ?? "Unknown country"}
                  </p>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
