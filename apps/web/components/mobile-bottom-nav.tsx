"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import {
  Bell,
  Bookmark,
  Home,
  LayoutDashboard,
  Menu,
  Search,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { useState } from "react";

import { getISCSectorSearchParam, ISC_SECTORS } from "@/lib/isc-sectors";
import { cn } from "@/lib/utils";

const BOTTOM_NAV = [
  { icon: Home, label: "হোম", labelEn: "Home", href: "/" },
  { icon: Search, label: "চাকরি", labelEn: "Jobs", href: "/search?record_type=job" },
  { icon: Bookmark, label: "সংরক্ষিত", labelEn: "Saved", href: "/saved" },
  { icon: Bell, label: "সতর্কতা", labelEn: "Alerts", href: "/alerts" },
] as const;

const NAV_LINKS = [
  { href: "/", label: "হোম", labelEn: "Home", icon: Home },
  { href: "/search?record_type=job", label: "চাকরি খুঁজুন", labelEn: "Find Jobs", icon: Search },
  { href: "/search?record_type=scholarship", label: "স্কলারশিপ", labelEn: "Scholarships", icon: Sparkles },
  { href: "/search?trust_tier=official_gov", label: "সরকারি নোটিশ", labelEn: "Official Notices", icon: LayoutDashboard },
  { href: "/saved", label: "সংরক্ষিত", labelEn: "Saved", icon: Bookmark },
  { href: "/alerts", label: "সতর্কতা", labelEn: "Alerts", icon: Bell },
  { href: "/help", label: "সাহায্য", labelEn: "Help", icon: Sparkles },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const locale = useLocale();
  const isEn = locale === "en";
  const [open, setOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  return (
    <>
      <nav
        aria-label={isEn ? "Mobile bottom navigation" : "মোবাইল নিচের নেভিগেশন"}
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm md:hidden"
      >
        <div className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {BOTTOM_NAV.map(({ icon: Icon, label, labelEn, href }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

            return (
              <Link
                key={href}
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
            className="absolute inset-y-0 left-0 flex h-full w-[85vw] flex-col border-r border-border bg-white shadow-2xl rounded-r-[2.5rem] overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  {isEn ? "Menu" : "মেনু"}
                </p>
                <h2 className="text-lg font-bold text-foreground">
                  {isEn ? "Browse navigation" : "নেভিগেশন দেখুন"}
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
                  {isEn ? "Navigation" : "নেভিগেশন"}
                </p>
                <div className="grid gap-2">
                  {NAV_LINKS.map(({ href, label, labelEn, icon: Icon }) => {
                    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

                    return (
                      <Link
                        key={href}
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

              <div className="h-px bg-border" />

              <div className="space-y-3">
                {!categoriesOpen ? (
                  <button
                    type="button"
                    onClick={() => setCategoriesOpen(true)}
                    className="flex w-full items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-left text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                    aria-label={isEn ? "Show more categories" : "আরও ক্যাটাগরি দেখুন"}
                  >
                    <span className="flex items-center gap-3">
                      <Search className="h-4 w-4 shrink-0" />
                      <span>{isEn ? "More categories →" : "আরও ক্যাটাগরি →"}</span>
                    </span>
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {isEn ? "Categories" : "ক্যাটাগরি"}
                      </p>
                      <button
                        type="button"
                        onClick={() => setCategoriesOpen(false)}
                        className="text-xs font-semibold text-primary"
                        aria-label={isEn ? "Hide categories" : "ক্যাটাগরি লুকান"}
                      >
                        {isEn ? "Show less" : "কম দেখুন"}
                      </button>
                    </div>
                    <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                      {ISC_SECTORS.map((sector) => {
                        const href = `/search?sector=${encodeURIComponent(getISCSectorSearchParam(sector.key))}` as Route;

                        return (
                          <Link
                            key={sector.key}
                            href={href}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
                          >
                            <Search className="h-4 w-4 shrink-0" />
                            <span>
                              <span className="block font-semibold">{sector.bn}</span>
                              <span className="block text-xs text-muted-foreground">{sector.en}</span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
