import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";

import { HeaderJobBrowseNav } from "@/components/header-job-browse-nav";
import { HeaderUserMenu } from "@/components/header-user-menu";
import { LanguageToggle } from "@/components/language-toggle";
import { SearchAutocomplete } from "@/components/search-autocomplete";
import { ThemeToggle } from "@/components/theme-toggle";
import { getLocale, getT } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/server-auth-fetch";
import type { OpportunityCategorySummary } from "@/lib/types";

function getBanglaDate(): string {
  return new Date().toLocaleDateString("bn-BD", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function SiteHeader({
  categories,
}: {
  categories: OpportunityCategorySummary[];
}) {
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
    <header className="sticky top-0 z-50 border-b border-border bg-white shadow-sm">
      <div className="hidden border-b border-border bg-muted/30 text-xs text-muted-foreground md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2">
          <span className="font-medium">{banglaDate}</span>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4">
          <Link href="/" className="shrink-0">
            <Image
              src="/assets/images/sudokkho-logo.png"
              alt="সুদক্ষ প্রবাস লোগো"
              width={220}
              height={70}
              className="h-10 w-auto sm:h-12"
              priority
            />
          </Link>

          <div className="hidden max-w-xl flex-1 md:block">
            <SearchAutocomplete isEn={isEn} />
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <HeaderUserMenu label={t("menu")} links={userMenuLinks} />
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

            <Link
              href="/search"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted/20 md:hidden"
            >
              <Search className="h-5 w-5 text-muted-foreground" />
            </Link>
          </div>
        </div>
      </div>

      <div className="hidden border-t border-border bg-white md:block">
        <div className="mx-auto max-w-7xl px-4">
          <HeaderJobBrowseNav categories={categories} isEn={isEn} />
        </div>
      </div>
    </header>
  );
}
