import type { Route } from "next";
import { getLocale } from "@/lib/i18n";
import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding-wizard";
import { getCurrentUser } from "@/lib/server-auth-fetch";
import { getSafeNextPath } from "@/lib/utils";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [user, params, locale] = await Promise.all([
    getCurrentUser(),
    searchParams,
    getLocale(),
  ]);
  const next = params.next;

  if (!user) {
    const loginRedirect = next ? `/auth/login?next=${encodeURIComponent(next)}` : "/auth/login";
    redirect(loginRedirect as Route);
  }

  if (user.onboarding_complete) {
    const target = getSafeNextPath(next);
    redirect(target as Route);
  }

  const isEn = locale === "en";

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-background flex flex-col justify-center py-10 sm:py-16">
      <div className="mx-auto w-full max-w-xl px-4">
        {/* Friendly Conversational Welcome Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
            {isEn ? "Profile Preferences" : "প্রোফাইল পছন্দসমূহ"}
          </h1>
          <p className="mt-3 text-base text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            {isEn
              ? "Give a few details to get better job recommendations"
              : "আরও ভালো চাকরি দেখানোর জন্য কয়েকটি সহজ তথ্য দিন।"}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isEn
              ? "Choose what you know or can do."
              : "আপনি যেটা জানেন বা পারেন, সেটাই বেছে নিন।"}
          </p>
        </div>

        {/* Wizard Card Container */}
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-card p-6 shadow-xl sm:p-8">
          <OnboardingWizard />
        </div>
      </div>
    </div>
  );
}

