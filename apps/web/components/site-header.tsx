import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";

import { HeaderNavLinks } from "@/components/header-nav-links";
import { HeaderUserMenu } from "@/components/header-user-menu";
import { LanguageToggle } from "@/components/language-toggle";
import { LogoutButton } from "@/components/logout-button";
import { MobileNav } from "@/components/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
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
  const isEn = locale === "en";

  const userMenuLinks: Array<{ label: string; href: Route }> = [
    { label: isEn ? "Dashboard" : "ড্যাশবোর্ড", href: "/dashboard" },
    { label: isEn ? "Alerts" : "সতর্কতা", href: "/alerts" },
    { label: "AI Copilot", href: "/copilot" },
    ...(user?.is_admin ? [{ label: "Admin", href: "/admin" as Route }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 shadow-sm backdrop-blur">
      <div className="hidden border-b border-border bg-muted/60 text-xs text-muted-foreground md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2">
          <span>{banglaDate}</span>
          <div className="ml-auto flex items-center gap-3">
            <LanguageToggle />
            <ThemeToggle />
            <span className="text-border">|</span>
            {user ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="font-medium text-foreground transition-colors hover:text-primary"
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
                  className="font-medium text-foreground transition-colors hover:text-primary"
                >
                  {isEn ? "Login" : "প্রবেশ করুন"}
                </Link>
                <Link
                  href="/auth/register"
                  className="rounded-full bg-primary px-3 py-1 font-semibold text-white transition-opacity hover:opacity-90"
                >
                  {isEn ? "Free Account" : "ফ্রি অ্যাকাউন্ট"}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-border bg-card">
        <div className="mx-auto hidden max-w-7xl items-center gap-4 px-4 py-4 md:flex">
          <Link href="/" className="shrink-0">
            <Image
              src="/assets/images/sudokkho-logo.png"
              alt="সুদক্ষ প্রবাস লোগো"
              width={220}
              height={70}
              className="h-11 w-auto"
              priority
            />
          </Link>

          <form action="/search" className="flex flex-1">
            <label className="flex w-full items-center gap-2 rounded-full border border-border bg-background px-4 py-3 text-sm transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                name="q"
                placeholder={
                  isEn
                    ? "Search jobs, scholarships, countries, or visa updates"
                    : "চাকরি, স্কলারশিপ, দেশ বা ভিসা আপডেট খুঁজুন"
                }
                className="flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/80"
                autoComplete="off"
              />
            </label>
          </form>

          <div className="ml-auto">
            {user ? (
              <HeaderUserMenu
                label={isEn ? "Menu" : "মেনু"}
                links={userMenuLinks}
              />
            ) : (
              <Link
                href="/auth/register"
                className="inline-flex items-center rounded-full bg-primary px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                {isEn ? "Free Account" : "ফ্রি অ্যাকাউন্ট"}
              </Link>
            )}
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:hidden">
          <Link href="/" className="shrink-0">
            <Image
              src="/assets/images/sudokkho-logo.png"
              alt="সুদক্ষ প্রবাস লোগো"
              width={180}
              height={56}
              className="h-10 w-auto"
              priority
            />
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/search"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Search className="h-3.5 w-3.5" />
              <span>{isEn ? "Search" : "খুঁজুন"}</span>
            </Link>
            <ThemeToggle />
            <LanguageToggle />
            <MobileNav navLinks={NAV_LINKS} user={user} />
          </div>
        </div>
      </div>

      <div className="hidden bg-[#0a1f44] md:block">
        <div className="mx-auto max-w-7xl px-4">
          <HeaderNavLinks links={NAV_LINKS} />
        </div>
      </div>
    </header>
  );
}
