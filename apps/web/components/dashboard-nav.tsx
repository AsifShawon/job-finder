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
      className="scrollbar-none flex items-center gap-2 overflow-x-auto rounded-2xl bg-[#0a1f44] p-2"
    >
      {items.map(({ href, label }) => {
        const active = pathname === String(href);

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
              active
                ? "bg-white text-[#0a1f44]"
                : "text-slate-200 hover:bg-white/10 hover:text-white",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
