import "./globals.css";

import type { Metadata } from "next";
import { Hind_Siliguri, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";

import { getLocale, getMessages } from "@/lib/i18n";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

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
    "বাংলাদেশিদের জন্য যাচাই করা বিদেশি চাকরি, বৃত্তি, ভিসা নীতি এবং দক্ষতা প্রশিক্ষণের তথ্য এক জায়গায়।",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${hindSiliguri.variable} ${inter.variable}`}
    >
      <body className="antialiased font-bengali min-h-screen bg-background text-foreground">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SiteHeader />
          <main className="min-h-screen">{children}</main>
          <SiteFooter locale={locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
