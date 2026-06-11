import type { Route } from "next";
import { getLocale, getT } from "@/lib/i18n";
import { redirect } from "next/navigation";
import { CheckCircle } from "lucide-react";

import { OnboardingWizard } from "@/components/onboarding-wizard";
import { getCurrentUser } from "@/lib/server-auth-fetch";
import { getSafeNextPath } from "@/lib/utils";

const STEPS = [
  { label: "সেক্টর বেছে নিন", en: "ISC Sectors" },
  { label: "দেশ পছন্দ", en: "Countries" },
  { label: "বর্তমান অবস্থা", en: "Current Status" },
  { label: "শিক্ষাগত যোগ্যতা", en: "Education" },
];

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
  const t = await getT("onboarding");

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[300px_1fr] lg:items-start">
          {/* Left sidebar: Step tracker */}
          <div className="hidden lg:block space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                সেটআপ প্রক্রিয়া
              </p>
              <h1 className="mt-2 text-2xl font-bold text-foreground">
                আপনার প্রোফাইল তৈরি করুন
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                আপনার পছন্দ অনুযায়ী সুযোগ খুঁজে পেতে এই ধাপগুলো সম্পন্ন করুন।
              </p>
            </div>

            <div className="space-y-2">
              {STEPS.map((step, i) => (
                <div
                  key={step.label}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{step.label}</p>
                    <p className="text-[11px] text-muted-foreground">{step.en}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  এই তথ্য আপনার সুযোগ সুপারিশ উন্নত করতে ব্যবহার হয়। যেকোনো
                  সময় পরিবর্তন করা যাবে।
                </p>
              </div>
            </div>
          </div>

          {/* Right: Wizard */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-card sm:p-8">
            <div className="mb-6 lg:hidden">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                সেটআপ প্রক্রিয়া
              </p>
              <h1 className="mt-1 text-xl font-bold text-foreground">{t("title")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {next && !isEn ? "আরও ভালো চাকরি দেখানোর জন্য কয়েকটি সহজ তথ্য দিন।" : t("subtitle")}
              </p>
            </div>
            <div className="hidden lg:block mb-6">
              <h2 className="text-xl font-bold text-foreground">{t("title")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {next && !isEn ? "আরও ভালো চাকরি দেখানোর জন্য কয়েকটি সহজ তথ্য দিন।" : t("subtitle")}
              </p>
            </div>
            <OnboardingWizard />
          </div>
        </div>
      </div>
    </div>
  );
}

