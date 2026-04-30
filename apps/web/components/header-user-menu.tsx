"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import type { Route } from "next";

type MenuLink = {
  href: Route;
  label: string;
};

export function HeaderUserMenu({
  label,
  links,
}: {
  label: string;
  links: MenuLink[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
        aria-expanded={open}
        aria-label={label}
      >
        <Menu className="h-4 w-4" />
        <span>{label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-60 rounded-2xl border border-border bg-card p-2 shadow-2xl">
          <nav aria-label={label} className="grid gap-1">
            {links.map(({ href, label: linkLabel }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted hover:text-primary"
              >
                {linkLabel}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
