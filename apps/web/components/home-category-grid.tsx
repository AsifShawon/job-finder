"use client";

import type { Route } from "next";
import Link from "next/link";
import { BriefcaseBusiness, ChevronDown, Factory, Hammer, Laptop2, Package, Stethoscope, Wheat } from "lucide-react";
import { useMemo, useState } from "react";

import type { OpportunityCategorySummary } from "@/lib/types";
import { buildISCCategoryHref, getDefaultOpportunityCategories } from "@/lib/isc-sectors";
import { cn } from "@/lib/utils";

const CATEGORY_ICON_MAP: Record<string, typeof BriefcaseBusiness> = {
  agrofood_isc: Wheat,
  agriculture_isc: Wheat,
  construction_isc: Hammer,
  furniture_isc: Package,
  ict_isc: Laptop2,
  informal_isc: BriefcaseBusiness,
  light_eng_isc: Factory,
  pharma_isc: Stethoscope,
};

function getCategoryIcon(key: string) {
  return CATEGORY_ICON_MAP[key] ?? BriefcaseBusiness;
}

export function HomeCategoryGrid({
  categories,
  isEn,
}: {
  categories: OpportunityCategorySummary[];
  isEn: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = categories.length > 0 ? categories : getDefaultOpportunityCategories();
  const visibleCategories = expanded ? items : items.slice(0, 6);
  const remainingCount = Math.max(items.length - 6, 0);
  const topCategoryCount = useMemo(
    () => items.reduce((count, category) => Math.max(count, category.job_count), 0),
    [items],
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {visibleCategories.map((category) => {
          const Icon = getCategoryIcon(category.key);
          const href = buildISCCategoryHref(category.key);
          const highlighted = topCategoryCount > 0 && category.job_count === topCategoryCount;

          return (
            <Link
              key={category.key}
              href={href as Route}
              className={cn(
                "group flex min-h-[12rem] flex-col justify-between rounded-[2rem] border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg",
                highlighted ? "border-primary/30 bg-primary/[0.04]" : "border-border",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                  <Icon className="h-7 w-7" />
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {category.job_count}
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground group-hover:text-primary">
                  {isEn ? category.label_en : category.label_bn}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isEn ? category.label_bn : category.label_en}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {remainingCount > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <span>
              {expanded
                ? (isEn ? "Show less" : "কম দেখুন")
                : (isEn ? `Show more (${remainingCount})` : `আরও দেখুন (${remainingCount})`)}
            </span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
          </button>
        </div>
      )}
    </div>
  );
}
