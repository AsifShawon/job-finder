"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

import { cn } from "@/lib/utils";

type DashboardNavItem = {
  href: Route;
  label: string;
};

export function DashboardNav({
  items,
}: {
  items: DashboardNavItem[];
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard navigation"
      className="scrollbar-none flex max-w-full items-center gap-1.5 overflow-x-auto rounded-xl bg-slate-100 dark:bg-slate-800/40 p-1"
    >
      {items.map(({ href, label }) => {
        const active = pathname === String(href);

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-colors select-none",
              active
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/30",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
