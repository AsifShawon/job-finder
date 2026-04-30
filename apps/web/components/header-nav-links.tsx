"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

import { cn } from "@/lib/utils";

export function HeaderNavLinks({
  links,
}: {
  links: Array<{ href: Route; label: string }>;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="scrollbar-none flex items-center overflow-x-auto">
      {links.map(({ href, label }) => {
        const hrefString = String(href);
        const active =
          hrefString === "/"
            ? pathname === "/"
            : hrefString.startsWith("/search")
              ? pathname.startsWith("/search")
              : pathname.startsWith(hrefString);

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
              active
                ? "border-white text-white"
                : "border-transparent text-slate-200 hover:border-white/80 hover:text-white",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
