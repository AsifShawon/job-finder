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
              "relative whitespace-nowrap px-4 py-4 text-sm font-semibold transition-all",
              active
                ? "text-primary after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-primary"
                : "text-muted-foreground hover:text-primary",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
