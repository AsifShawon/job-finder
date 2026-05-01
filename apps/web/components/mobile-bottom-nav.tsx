"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import {
  Bell,
  Bookmark,
  ChevronDown,
  ChevronUp,
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
  { icon: Search, label: "খুঁজুন", labelEn: "Search", href: "/search" },
  { icon: Bookmark, label: "সংরক্ষিত", labelEn: "Saved", href: "/saved" },
  { icon: Bell, label: "সতর্কতা", labelEn: "Alerts", href: "/alerts" },
] as const;

const NAV_LINKS = [
  { href: "/", label: "হোম", labelEn: "Home", icon: Home },
  { href: "/search", label: "সব সুযোগ", labelEn: "All opportunities", icon: Search },
  { href: "/dashboard", label: "ড্যাশবোর্ড", labelEn: "Dashboard", icon: LayoutDashboard },
  { href: "/copilot", label: "AI সহকারী", labelEn: "AI Copilot", icon: Sparkles },
  { href: "/auth/register", label: "ফ্রি অ্যাকাউন্ট", labelEn: "Free Account", icon: UserPlus },
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
                className={cn(
                  "flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{isEn ? labelEn : label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-primary"
            aria-label={isEn ? "Open menu" : "মেনু খুলুন"}
          >
            <Menu className="h-4 w-4" />
            <span>{isEn ? "Menu" : "মেনু"}</span>
          </button>
        </div>
      </nav>

      {open && (
        <div
          className="fixed inset-0 z-[60] bg-[#07152f]/70 md:hidden"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute inset-y-0 left-0 flex h-full w-[75vw] flex-col border-r border-border bg-card shadow-2xl"
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
                <button
                  type="button"
                  onClick={() => setCategoriesOpen((current) => !current)}
                  className="flex w-full items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-left text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <span className="flex items-center gap-3">
                    <Search className="h-4 w-4 shrink-0" />
                    <span>{isEn ? "Categories" : "ক্যাটাগরি"}</span>
                  </span>
                  {categoriesOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {categoriesOpen && (
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
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
