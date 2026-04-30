import type { Route } from "next";
import Link from "next/link";
import {
  LayoutDashboard,
  Database,
  Activity,
  ClipboardCheck,
  Shield,
} from "lucide-react";

import { getLocale } from "@/lib/i18n";
import { requireAdminUser } from "@/lib/server-auth-fetch";

const ADMIN_LINKS: Array<{ label: string; labelEn: string; href: Route; icon: React.ElementType }> = [
  { label: "ওভারভিউ", labelEn: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "উৎস", labelEn: "Sources", href: "/admin/sources", icon: Database },
  { label: "ক্রল", labelEn: "Crawls", href: "/admin/crawls", icon: Activity },
  { label: "পর্যালোচনা", labelEn: "Review", href: "/admin/review", icon: ClipboardCheck },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, locale] = await Promise.all([requireAdminUser(), getLocale()]);
  const isEn = locale === "en";

  return (
    <div className="min-h-screen bg-background">
      {/* Admin top banner */}
      <div
        className="border-b border-border bg-navy text-white"
        role="region"
        aria-label={isEn ? "Admin top bar" : "অ্যাডমিন উপরের বার"}
      >
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/90">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold">
                  {isEn ? "Admin Console" : "অ্যাডমিন কনসোল"}
                </p>
                <p className="text-[11px] text-slate-400">
                  {isEn ? `Signed in as ${user.full_name}` : `${user.full_name} হিসেবে প্রবেশ`}
                </p>
              </div>
            </div>

            {/* Admin nav */}
            <nav className="flex items-center gap-1">
              {ADMIN_LINKS.map(({ label, labelEn, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:border-white/40 hover:bg-white/20 transition-colors"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {isEn ? labelEn : label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div
        className="mx-auto max-w-7xl px-4 py-6"
        role="region"
        aria-label={isEn ? "Admin page content" : "অ্যাডমিন পেজের কনটেন্ট"}
      >
        {children}
      </div>
    </div>
  );
}
