import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";

import { LanguageToggle } from "@/components/language-toggle";
import { LogoutButton } from "@/components/logout-button";
import { MobileNav } from "@/components/mobile-nav";
import { getCurrentUser } from "@/lib/server-auth-fetch";
import { getLocale } from "@/lib/i18n";

const NAV_LINKS: Array<{ label: string; href: Route }> = [
  { label: "সব সুযোগ", href: "/search" },
  { label: "প্রবাস চাকরি", href: "/search?record_type=job" },
  { label: "দক্ষতা প্রশিক্ষণ", href: "/search?source_class=bd_migration" },
  { label: "স্কলারশিপ", href: "/search?record_type=scholarship" },
  { label: "ভিসা নীতি", href: "/search?record_type=policy_update" },
  { label: "সরকারি সার্কুলার", href: "/search?trust_tier=official_gov" },
];

function getBanglaDate(): string {
  return new Date().toLocaleDateString("bn-BD", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function SiteHeader() {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const banglaDate = getBanglaDate();

  return (
    <header className="sticky top-0 z-50 shadow-sm">
      {/* ── Top utility bar ── */}
      <div className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5">
          <span className="hidden sm:block">{banglaDate}</span>
          <div className="ml-auto flex items-center gap-3">
            <LanguageToggle />
            {user ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="font-medium text-foreground hover:text-primary transition-colors"
                >
                  {user.full_name.split(" ")[0]}
                </Link>
                <span className="text-border">|</span>
                <LogoutButton />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/auth/login"
                  className="font-medium text-foreground hover:text-primary transition-colors"
                >
                  প্রবেশ করুন
                </Link>
                <Link
                  href="/auth/register"
                  className="rounded bg-primary px-2.5 py-0.5 font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  ফ্রি অ্যাকাউন্ট
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main header: logo + search ── */}
      <div className="border-b border-border bg-white dark:bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          {/* Logo */}
          <Link href="/" className="shrink-0">
            <Image
              src="/assets/images/sudokkho-logo.png"
              alt="Sudokkho"
              width={220}
              height={70}
              className="h-10 w-auto sm:h-11"
              priority
            />
          </Link>

          {/* Search */}
          <form action="/search" className="hidden flex-1 md:flex">
            <label className="flex w-full items-center gap-2 rounded-md border border-border bg-muted/60 px-3 py-2.5 text-sm transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                name="q"
                placeholder="চাকরি, স্কলারশিপ বা দেশ খুঁজুন…"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/80"
                autoComplete="off"
              />
            </label>
          </form>

          {/* Mobile hamburger */}
          <div className="ml-auto md:hidden">
            <MobileNav navLinks={NAV_LINKS} user={user} />
          </div>
        </div>
      </div>

      {/* ── Navigation row ── */}
      <div className="bg-[#0a1f44]">
        <div className="mx-auto max-w-7xl px-4">
          <nav className="scrollbar-none flex items-center overflow-x-auto">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-primary hover:text-white"
              >
                {label}
              </Link>
            ))}

            {user && (
              <>
                <div className="mx-2 h-4 w-px shrink-0 bg-white/20" />
                <Link
                  href="/dashboard"
                  className="whitespace-nowrap px-3.5 py-2.5 text-sm font-medium text-slate-200 hover:text-white transition-colors"
                >
                  ড্যাশবোর্ড
                </Link>
                <Link
                  href="/alerts"
                  className="whitespace-nowrap px-3.5 py-2.5 text-sm font-medium text-slate-200 hover:text-white transition-colors"
                >
                  সতর্কতা
                </Link>
                <Link
                  href="/copilot"
                  className="whitespace-nowrap px-3.5 py-2.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  AI Copilot
                </Link>
                {user.is_admin && (
                  <Link
                    href="/admin"
                    className="whitespace-nowrap px-3.5 py-2.5 text-sm font-medium text-slate-200 hover:text-white transition-colors"
                  >
                    Admin
                  </Link>
                )}
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
