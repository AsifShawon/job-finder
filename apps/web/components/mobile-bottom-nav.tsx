"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { Bell, Bookmark, Home, Menu, Search, X } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

const BOTTOM_NAV = [
  { icon: Home, label: "হোম", labelEn: "Home", href: "/" },
  { icon: Search, label: "খুঁজুন", labelEn: "Search", href: "/search" },
  { icon: Bookmark, label: "সংরক্ষিত", labelEn: "Saved", href: "/saved" },
  { icon: Bell, label: "সতর্কতা", labelEn: "Alerts", href: "/alerts" },
] as const;

const MORE_LINKS = [
  { href: "/dashboard", label: "ড্যাশবোর্ড", labelEn: "Dashboard" },
  { href: "/copilot", label: "AI সহকারী", labelEn: "AI Copilot" },
  { href: "/auth/login", label: "লগইন", labelEn: "Login" },
  { href: "/auth/register", label: "ফ্রি অ্যাকাউন্ট", labelEn: "Free Account" },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const locale = useLocale();
  const isEn = locale === "en";
  const [open, setOpen] = useState(false);

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
            aria-label={isEn ? "Open more menu" : "আরও মেনু খুলুন"}
          >
            <Menu className="h-4 w-4" />
            <span>{isEn ? "More" : "মেনু"}</span>
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-[60] bg-[#07152f]/70 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-border bg-card px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">
                {isEn ? "More options" : "আরও অপশন"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                <span>{isEn ? "Close" : "বন্ধ"}</span>
              </button>
            </div>

            <div className="grid gap-2">
              {MORE_LINKS.map(({ href, label, labelEn }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground"
                >
                  {isEn ? labelEn : label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
