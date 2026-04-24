import type { Route } from "next";
import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/server-auth-fetch";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const links: Array<{ label: string; href: Route }> = [
    { label: "Search", href: "/search" as Route },
    { label: "Copilot", href: "/copilot" as Route },
    ...(user
      ? [
          { label: "Dashboard", href: "/dashboard" as Route },
          { label: "Saved", href: "/saved" as Route },
          { label: "Alerts", href: "/alerts" as Route },
        ]
      : []),
    ...(user?.is_admin ? [{ label: "Admin", href: "/admin" as Route }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-display text-xl font-bold tracking-tight">
            OOI Bangladesh
          </Link>
          <Badge className="hidden md:inline-flex">Verified opportunity intelligence</Badge>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          {links.map(({ label, href }) => (
            <Link key={href} href={href} className="font-medium text-slate-700 transition-colors hover:text-primary dark:text-slate-200">
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden text-right md:block">
                <p className="text-sm font-semibold">{user.full_name}</p>
                <p className="text-xs text-slate-500">{user.is_admin ? "Administrator" : "Member"}</p>
              </div>
              {user.is_admin && <Badge>Admin</Badge>}
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/auth/login" className="text-sm font-semibold text-slate-700 hover:text-primary dark:text-slate-200">
                Sign in
              </Link>
              <Link
                href="/auth/register"
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
              >
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
