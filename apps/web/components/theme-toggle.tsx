"use client";

import { Moon, SunMedium } from "lucide-react";
import { useLocale } from "next-intl";

import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  className,
}: {
  className?: string;
}) {
  const locale = useLocale();
  const { isDark, toggleTheme } = useTheme();
  const isEn = locale === "en";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary",
        className,
      )}
      aria-label={isEn ? "Switch color theme" : "রঙের থিম বদলান"}
    >
      {isDark ? <SunMedium className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      <span>{isDark ? (isEn ? "Light" : "লাইট") : (isEn ? "Dark" : "ডার্ক")}</span>
    </button>
  );
}
