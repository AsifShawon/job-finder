import type { Route } from "next";
import Link from "next/link";

import { requireAdminUser } from "@/lib/server-auth-fetch";

const adminLinks = [
  ["Overview", "/admin"],
  ["Sources", "/admin/sources"],
  ["Crawls", "/admin/crawls"],
  ["Review", "/admin/review"],
] as const satisfies ReadonlyArray<readonly [string, Route]>;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminUser();

  return (
    <div className="space-y-6">
      <section className="border-b border-slate-200 bg-white/65 pb-5 dark:border-slate-800 dark:bg-slate-950/50">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Admin workspace</p>
            <h1 className="font-display text-3xl font-bold tracking-tight">Operations console</h1>
            <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              Signed in as {user.full_name}. Manage sources, monitor crawls, and keep ingestion healthy.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2">
          {adminLinks.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              {label}
            </Link>
          ))}
          </nav>
        </div>
      </section>
      {children}
    </div>
  );
}
