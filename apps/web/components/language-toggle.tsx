"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchLocale() {
    const next = locale === "bn" ? "en" : "bn";
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <button
      onClick={switchLocale}
      disabled={isPending}
      className="rounded-lg border border-white/35 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:border-white/70 hover:bg-white/20 disabled:opacity-50"
      aria-label={locale === "bn" ? "View in English" : "View in Bangla"}
    >
      {locale === "bn" ? "English" : "Bangla"}
    </button>
  );
}
