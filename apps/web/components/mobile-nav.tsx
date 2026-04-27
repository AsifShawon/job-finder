"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Search } from "lucide-react";
import type { Route } from "next";
import type { AuthUser } from "@/lib/types";

interface MobileNavProps {
  navLinks: Array<{ label: string; href: Route }>;
  user: AuthUser | null;
}

export function MobileNav({ navLinks, user }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "মেনু বন্ধ করুন" : "মেনু খুলুন"}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-white/35 text-white hover:border-white/70 transition-colors"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open && (
        <div className="fixed inset-0 top-[57px] z-50 overflow-y-auto border-t border-white/20 bg-[#071a3a]/95 text-white backdrop-blur-md">
          <div className="p-4 space-y-1">
            {/* Mobile search */}
            <form action="/search" className="mb-4">
              <label className="flex items-center gap-2 rounded-md border border-white/35 bg-white/10 px-3 py-2.5 text-sm focus-within:border-white/70 focus-within:ring-1 focus-within:ring-white/30">
                <Search className="h-4 w-4 shrink-0 text-slate-100" />
                <input
                  name="q"
                  placeholder="চাকরি, স্কলারশিপ বা দেশ খুঁজুন…"
                  className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-100/80"
                />
              </label>
            </form>

            {navLinks.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="block rounded-md px-4 py-2.5 text-sm font-medium text-white/95 transition-colors hover:bg-white/10"
              >
                {label}
              </Link>
            ))}

            <div className="my-3 h-px bg-white/20" />

            {user ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-4 py-2.5 text-sm font-medium text-white/95 hover:bg-white/10"
                >
                  ড্যাশবোর্ড
                </Link>
                <Link
                  href="/saved"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-4 py-2.5 text-sm font-medium text-white/95 hover:bg-white/10"
                >
                  সংরক্ষিত
                </Link>
                <Link
                  href="/alerts"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-4 py-2.5 text-sm font-medium text-white/95 hover:bg-white/10"
                >
                  সতর্কতা
                </Link>
                <Link
                  href="/copilot"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-4 py-2.5 text-sm font-semibold text-primary hover:bg-white/10"
                >
                  AI Copilot
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-4 py-2.5 text-sm font-medium text-white/95 hover:bg-white/10"
                >
                  প্রবেশ করুন
                </Link>
                <Link
                  href="/auth/register"
                  onClick={() => setOpen(false)}
                  className="mt-2 block rounded-md border border-white/40 bg-white/10 px-4 py-2.5 text-center text-sm font-bold text-white"
                >
                  ফ্রি অ্যাকাউন্ট তৈরি করুন
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
