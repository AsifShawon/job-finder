import type { Route } from "next";

import { ALL_JOBS_OPPORTUNITY_TYPES } from "@/lib/isc-sectors";
import type { OpportunityQuickAccessSummary } from "@/lib/types";

export function buildQuickAccessHref(categoryKey: string, country: string): Route {
  const params = new URLSearchParams({
    opportunity_type: ALL_JOBS_OPPORTUNITY_TYPES,
    isc_category_key: categoryKey,
    country,
  });
  return `/search?${params.toString()}` as Route;
}

export function getQuickAccessLabel(item: OpportunityQuickAccessSummary, isEn: boolean): string {
  if (isEn) {
    return `${item.category_label_en} jobs in ${item.country}`;
  }
  return `${item.country}-এ ${item.category_label_bn} চাকরি`;
}
