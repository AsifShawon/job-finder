import "./globals.css";

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Hind_Siliguri, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";

import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { getLocale, getMessages } from "@/lib/i18n";

const hindSiliguri = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bengali",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "সুযোগ বিডি — বিশ্বস্ত বিদেশি সুযোগের প্ল্যাটফর্ম",
  description:
    "বাংলাদেশিদের জন্য যাচাই করা বিদেশি চাকরি, বৃত্তি, ভিসা নীতি এবং দক্ষতা প্রশিক্ষণের তথ্য এক জায়গায়।",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, messages, cookieStore] = await Promise.all([
    getLocale(),
    getMessages(),
    cookies(),
  ]);
  const defaultTheme = cookieStore.get("THEME_PREF")?.value === "dark" ? "dark" : "light";

  return (
    <html
      lang={locale}
      className={`${hindSiliguri.variable} ${inter.variable} ${defaultTheme === "dark" ? "dark" : ""}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-bengali text-foreground antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  try {
    const cookieMatch = document.cookie.match(/(?:^|; )THEME_PREF=([^;]+)/);
    const cookieTheme = cookieMatch ? decodeURIComponent(cookieMatch[1]) : "";
    const storedTheme = localStorage.getItem("THEME_PREF");
    const theme = storedTheme === "dark" || storedTheme === "light"
      ? storedTheme
      : (cookieTheme === "dark" || cookieTheme === "light" ? cookieTheme : "${defaultTheme}");
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
  } catch {}
})();`,
          }}
        />
        <ThemeProvider defaultTheme={defaultTheme}>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <SiteHeader />
            <main className="min-h-screen">
              <div className="pb-16 md:pb-0">{children}</div>
            </main>
            <MobileBottomNav />
            <SiteFooter locale={locale} />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
