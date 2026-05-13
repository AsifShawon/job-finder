import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";

import { HeaderNavLinks } from "@/components/header-nav-links";
import { HeaderUserMenu } from "@/components/header-user-menu";
import { LanguageToggle } from "@/components/language-toggle";
import { LogoutButton } from "@/components/logout-button";
import { SearchAutocomplete } from "@/components/search-autocomplete";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/server-auth-fetch";
import { getLocale, getT } from "@/lib/i18n";

const NAV_LINKS: Array<{ label: string; labelEn: string; href: Route }> = [
  { label: "হোম", labelEn: "Home", href: "/" as Route },
  { label: "চাকরি খুঁজুন", labelEn: "Find Jobs", href: "/search?record_type=job" as Route },
  { label: "স্কলারশিপ", labelEn: "Scholarships", href: "/search?record_type=scholarship" as Route },
  { label: "সরকারি নোটিশ", labelEn: "Official Notices", href: "/search?trust_tier=official_gov" as Route },
  { label: "সংরক্ষিত", labelEn: "Saved", href: "/saved" as Route },
  { label: "সতর্কতা", labelEn: "Alerts", href: "/alerts" as Route },
  { label: "সুদক্ষ AI", labelEn: "Sudokkho AI", href: "/copilot" as Route },
  { label: "সাহায্য", labelEn: "Help", href: "/help" as Route },
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
  const [user, locale, t] = await Promise.all([
    getCurrentUser(),
    getLocale(),
    getT("nav"),
  ]);
  const banglaDate = getBanglaDate();
  const isEn = locale === "en";

  const userMenuLinks: Array<{ label: string; href: Route }> = [
    { label: t("dashboard"), href: "/dashboard" },
    { label: t("alerts"), href: "/alerts" },
    { label: t("copilot"), href: "/copilot" },
    ...(user?.is_admin ? [{ label: t("admin"), href: "/admin" as Route }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
      {/* Mini top bar - simplified */}
      <div className="hidden border-b border-border bg-muted/30 text-xs text-muted-foreground md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2">
          <span className="font-medium">{banglaDate}</span>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4">
          <Link href="/" className="shrink-0">
            <Image
              src="/assets/images/sudokkho-logo.png"
              alt="সুদক্ষ প্রবাস লোগো"
              width={220}
              height={70}
              className="h-10 sm:h-12 w-auto"
              priority
            />
          </Link>

          <div className="hidden flex-1 max-w-xl md:block">
            <SearchAutocomplete isEn={isEn} />
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <HeaderUserMenu
                label={t("menu")}
                links={userMenuLinks}
              />
            ) : (
              <div className="hidden items-center gap-3 md:flex">
                <Link
                  href="/auth/login"
                  className="text-sm font-bold text-muted-foreground transition-colors hover:text-primary"
                >
                  {t("login")}
                </Link>
                <Link
                  href="/auth/register"
                  className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition-all hover:shadow-lg active:scale-95"
                >
                  {t("freeAccount")}
                </Link>
              </div>
            )}
            
            {/* Mobile search trigger */}
            <Link
              href="/search"
              className="inline-flex items-center justify-center h-10 w-10 rounded-full border border-border bg-muted/20 md:hidden"
            >
              <Search className="h-5 w-5 text-muted-foreground" />
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation - Tablet/Desktop only */}
      <div className="hidden border-t border-border bg-white md:block">
        <div className="mx-auto max-w-7xl px-4">
          <HeaderNavLinks
            links={NAV_LINKS.map((link) => ({
              href: link.href,
              label: isEn ? link.labelEn : link.label,
            }))}
          />
        </div>
      </div>
    </header>
  );
}
