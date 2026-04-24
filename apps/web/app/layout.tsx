import "./globals.css";

import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Overseas Opportunity Intelligence Platform",
  description: "Verified overseas jobs, scholarships, and policy updates for Bangladeshis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SiteHeader />
        <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:py-10">{children}</main>
      </body>
    </html>
  );
}
