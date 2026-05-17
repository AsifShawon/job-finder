"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import {
  Bell,
  Bookmark,
  ChevronDown,
  Home,
  LayoutDashboard,
  Menu,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";

import type { OpportunityCategorySummary } from "@/lib/types";
import {
  ALL_JOBS_OPPORTUNITY_TYPES,
  buildAllJobsHref,
  buildISCCategoryHref,
  getDefaultOpportunityCategories,
} from "@/lib/isc-sectors";
import { cn } from "@/lib/utils";

const BOTTOM_NAV = [
  { icon: Home, label: "হোম", labelEn: "Home", href: "/" },
  { icon: Search, label: "চাকরি", labelEn: "Jobs", href: buildAllJobsHref() },
  { icon: Bookmark, label: "সংরক্ষিত", labelEn: "Saved", href: "/saved" as Route },
  { icon: Sparkles, label: "সুদক্ষ AI", labelEn: "Sudokkho AI", href: "/copilot" as Route },
] as const;

const SECONDARY_LINKS = [
  { href: "/" as Route, label: "হোম", labelEn: "Home", icon: Home },
  { href: "/saved" as Route, label: "সংরক্ষিত", labelEn: "Saved", icon: Bookmark },
  { href: "/alerts" as Route, label: "সতর্কতা", labelEn: "Alerts", icon: Bell },
  { href: "/copilot" as Route, label: "সুদক্ষ AI", labelEn: "Sudokkho AI", icon: Sparkles },
  { href: "/help" as Route, label: "সাহায্য", labelEn: "Help", icon: LayoutDashboard },
] as const;

function isAllJobsActive(pathname: string, opportunityType: string | null, categoryKey: string | null) {
  return pathname.startsWith("/search") && opportunityType === ALL_JOBS_OPPORTUNITY_TYPES && !categoryKey;
}

export function MobileBottomNav({
  categories,
}: {
  categories: OpportunityCategorySummary[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const isEn = locale === "en";
  const [open, setOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(Boolean(searchParams.get("isc_category_key")));
  const items = categories.length > 0 ? categories : getDefaultOpportunityCategories();
  const activeCategoryKey = searchParams.get("isc_category_key");
  const activeOpportunityType = searchParams.get("opportunity_type");

  return (
    <>
      <nav
        aria-label={isEn ? "Mobile bottom navigation" : "মোবাইল নিচের নেভিগেশন"}
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm md:hidden"
      >
        <div className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {BOTTOM_NAV.map(({ icon: Icon, label, labelEn, href }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : String(href).startsWith("/search")
                  ? isAllJobsActive(pathname, activeOpportunityType, activeCategoryKey)
                  : pathname.startsWith(String(href));

            return (
              <Link
                key={String(href)}
                href={href}
                aria-label={isEn ? labelEn : label}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-3 text-[11px] font-bold transition-all active:scale-90",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("h-6 w-6 transition-transform", active && "scale-110")} />
                <span className="mt-1">{isEn ? labelEn : label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-semibold text-muted-foreground transition hover:text-primary active:scale-95"
            aria-label={isEn ? "Open menu" : "মেনু খুলুন"}
          >
            <Menu className="h-5 w-5" />
            <span className="text-[11px]">{isEn ? "Menu" : "মেনু"}</span>
            <span className="h-1 w-1 rounded-full bg-transparent" />
          </button>
        </div>
      </nav>

      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 md:hidden"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute inset-y-0 left-0 flex h-full w-[85vw] flex-col overflow-hidden rounded-r-[2.5rem] border-r border-border bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  {isEn ? "Browse" : "ব্রাউজ"}
                </p>
                <h2 className="text-lg font-bold text-foreground">
                  {isEn ? "Jobs navigation" : "চাকরি নেভিগেশন"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                <span>{isEn ? "Close" : "বন্ধ"}</span>
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {isEn ? "Browse jobs" : "চাকরি ব্রাউজ"}
                </p>

                <Link
                  href={buildAllJobsHref()}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors",
                    isAllJobsActive(pathname, activeOpportunityType, activeCategoryKey)
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-background text-foreground hover:border-primary hover:text-primary",
                  )}
                >
                  <Search className="h-4 w-4" />
                  <span>{isEn ? "All Jobs" : "সব চাকরি"}</span>
                </Link>

                <div className="rounded-2xl border border-border bg-background">
                  <button
                    type="button"
                    onClick={() => setCategoriesOpen((current) => !current)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-foreground"
                  >
                    <span>{isEn ? "Category" : "ক্যাটাগরি"}</span>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", categoriesOpen && "rotate-180")} />
                  </button>

                  {categoriesOpen && (
                    <div className="max-h-80 space-y-1 overflow-y-auto border-t border-border p-2">
                      {items.map((category) => {
                        const href = buildISCCategoryHref(category.key);
                        const active = activeCategoryKey === category.key;

                        return (
                          <Link
                            key={category.key}
                            href={href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center justify-between rounded-2xl px-3 py-3 text-sm transition-colors",
                              active
                                ? "bg-primary/8 text-primary"
                                : "text-foreground hover:bg-muted/60 hover:text-primary",
                            )}
                          >
                            <span>
                              <span className="block font-semibold">
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
                  )}
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {isEn ? "More" : "আরও"}
                </p>
                <div className="grid gap-2">
                  {SECONDARY_LINKS.map(({ href, label, labelEn, icon: Icon }) => {
                    const active = href === "/" ? pathname === "/" : pathname.startsWith(String(href));

                    return (
                      <Link
                        key={String(href)}
                        href={href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors",
                          active
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border bg-background text-foreground hover:border-primary hover:text-primary",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{isEn ? labelEn : label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
