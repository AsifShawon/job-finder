"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { OpportunityCategorySummary } from "@/lib/types";
import {
  ALL_JOBS_OPPORTUNITY_TYPES,
  buildAllJobsHref,
  buildISCCategoryHref,
  getDefaultOpportunityCategories,
} from "@/lib/isc-sectors";
import { cn } from "@/lib/utils";

function isAllJobsActive(pathname: string, searchParams: { get(name: string): string | null }) {
  return (
    pathname.startsWith("/search")
    && searchParams.get("opportunity_type") === ALL_JOBS_OPPORTUNITY_TYPES
    && !searchParams.get("isc_category_key")
  );
}

export function HeaderJobBrowseNav({
  categories,
  isEn,
}: {
  categories: OpportunityCategorySummary[];
  isEn: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const items = categories.length > 0 ? categories : getDefaultOpportunityCategories();
  const activeCategoryKey = searchParams.get("isc_category_key");
  const categoryActive = pathname.startsWith("/search") && Boolean(activeCategoryKey);
  const allJobsHref = buildAllJobsHref();

  return (
    <nav aria-label={isEn ? "Job browse navigation" : "চাকরি ব্রাউজ নেভিগেশন"} className="flex items-center gap-2">
      <Link
        href={allJobsHref}
        className={cn(
          "relative rounded-full px-4 py-4 text-sm font-semibold transition-colors",
          isAllJobsActive(pathname, searchParams)
            ? "text-primary after:absolute after:bottom-0 after:left-4 after:right-4 after:h-0.5 after:bg-primary"
            : "text-muted-foreground hover:text-primary",
        )}
      >
        {isEn ? "All Jobs" : "সব চাকরি"}
      </Link>

      <div
        className="relative"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "relative inline-flex items-center gap-2 rounded-full px-4 py-4 text-sm font-semibold transition-colors",
            categoryActive
              ? "text-primary after:absolute after:bottom-0 after:left-4 after:right-4 after:h-0.5 after:bg-primary"
              : "text-muted-foreground hover:text-primary",
          )}
          aria-expanded={open}
        >
          <span>{isEn ? "Category" : "ক্যাটাগরি"}</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 w-[21rem] pt-2">
            <div className="max-h-[28rem] overflow-y-auto rounded-3xl border border-border bg-white p-2 shadow-2xl">
              {items.map((category) => {
                const href = buildISCCategoryHref(category.key);
                const active = activeCategoryKey === category.key;

                return (
                  <Link
                    key={category.key}
                    href={href as Route}
                    className={cn(
                      "flex items-center justify-between rounded-2xl px-4 py-3 transition-colors",
                      active
                        ? "bg-primary/8 text-primary"
                        : "text-foreground hover:bg-muted/60 hover:text-primary",
                    )}
                  >
                    <span>
                      <span className="block text-sm font-semibold">
                        {isEn ? category.label_en : category.label_bn}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {isEn ? category.label_bn : category.label_en}
                      </span>
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      {category.job_count}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
