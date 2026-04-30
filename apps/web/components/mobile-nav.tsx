"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleUserRound, LogIn, Menu, Sparkles, X } from "lucide-react";
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
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "মেনু বন্ধ করুন" : "মেনু খুলুন"}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
      >
        {open ? <X className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}
        <span>মেনু</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-[#07152f]/70 backdrop-blur-sm">
          <div className="absolute inset-y-0 right-0 w-full max-w-sm overflow-y-auto border-l border-border bg-card p-4 text-foreground shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Menu</p>
                <h2 className="text-lg font-bold">Sudokkho Probash</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                <span>বন্ধ</span>
              </button>
            </div>

            <div className="grid gap-2">
              {navLinks.map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {label}
                </Link>
              ))}
            </div>

            <div className="my-4 h-px bg-border" />

            {user ? (
              <div className="grid gap-2">
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground"
                >
                  <CircleUserRound className="h-4 w-4 text-primary" />
                  <span>ড্যাশবোর্ড</span>
                </Link>
                <Link
                  href="/copilot"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground"
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>AI Copilot</span>
                </Link>
              </div>
            ) : (
              <div className="grid gap-2">
                <Link
                  href="/auth/login"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground"
                >
                  <LogIn className="h-4 w-4 text-primary" />
                  <span>প্রবেশ করুন</span>
                </Link>
                <Link
                  href="/auth/register"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white"
                >
                  ফ্রি অ্যাকাউন্ট তৈরি করুন
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
