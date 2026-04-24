import Link from "next/link";

import { Card } from "@/components/ui/card";

const stats = [
  ["Indexed records", "12,450+"],
  ["Official sources", "90+"],
  ["Daily crawls", "320"],
  ["Trusted countries", "45"],
];

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="grid gap-8 rounded-[2rem] border border-slate-200 bg-white/85 p-8 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/85 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Data product first</p>
          <h1 className="font-display text-4xl font-black leading-tight sm:text-6xl">
            Verified overseas opportunities, structured for real decision-making.
          </h1>
          <p className="max-w-2xl text-lg text-slate-700 dark:text-slate-200">
            Search trusted jobs, scholarships, and policy updates for Bangladeshis. Save what matters, automate alerts,
            and operate the crawl pipeline from a proper admin workspace.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/search" className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white">
              Explore opportunities
            </Link>
            <Link href="/dashboard" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold dark:border-slate-700">
              Open dashboard
            </Link>
            <Link href="/copilot" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold dark:border-slate-700">
              Ask Copilot
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {stats.map(([k, v]) => (
            <Card key={k} className="space-y-2 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{k}</p>
              <p className="font-display text-2xl font-bold">{v}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="space-y-3">
          <h3 className="font-display text-xl font-bold">Trust-aware ranking</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Official government and partner sources are ranked above portal and news-only records.
          </p>
        </Card>
        <Card className="space-y-3">
          <h3 className="font-display text-xl font-bold">Hybrid retrieval</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Lexical plus vector search and structured filters provide accurate, explainable discovery.
          </p>
        </Card>
        <Card className="space-y-3">
          <h3 className="font-display text-xl font-bold">Evidence-first AI</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Copilot answers only from indexed records and always attaches source and trust evidence.
          </p>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">For members</p>
          <h2 className="font-display text-2xl font-bold">A workflow, not just a search page</h2>
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>Save shortlisted roles and scholarships, create standing alerts, and return to a dashboard that reflects current opportunities.</p>
            <p>Compare trust, deadlines, and evidence-backed source links before committing application effort.</p>
          </div>
        </Card>
        <Card className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">For operators</p>
          <h2 className="font-display text-2xl font-bold">An actual admin console</h2>
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>Register sources, change crawl frequency, pause noisy feeds, trigger manual crawls, and review low-confidence extraction outputs.</p>
            <p>Use Flower and the admin dashboard together to monitor async throughput and investigate failures quickly.</p>
          </div>
        </Card>
      </section>
    </div>
  );
}
