"use client";

import type { Route } from "next";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ISC_SECTORS } from "@/lib/isc-sectors";
import { cn, getSafeNextPath } from "@/lib/utils";
import { UX_COPY } from "@/lib/ux-copy";
import { useVoiceOutput } from "@/hooks/use-voice-output";

const COUNTRIES = [
  { en: "Malaysia", bn: "মালয়েশিয়া" },
  { en: "Saudi Arabia", bn: "সৌদি আরব" },
  { en: "Qatar", bn: "কাতার" },
  { en: "United Arab Emirates", bn: "সংযুক্ত আরব আমিরাত" },
  { en: "Kuwait", bn: "কুয়েত" },
  { en: "Oman", bn: "ওমান" },
  { en: "Singapore", bn: "সিঙ্গাপুর" },
  { en: "South Korea", bn: "দক্ষিণ কোরিয়া" },
  { en: "Bahrain", bn: "বাহরাইন" },
  { en: "Japan", bn: "জাপান" },
  { en: "Italy", bn: "ইতালি" },
  { en: "United Kingdom", bn: "যুক্তরাজ্য" },
  { en: "Canada", bn: "কানাডা" },
  { en: "Australia", bn: "অস্ট্রেলিয়া" },
  { en: "Germany", bn: "জার্মানি" },
];

const STATUS_OPTIONS = ["student", "employed", "unemployed", "seeking_migration", "other"] as const;
const EDUCATION_OPTIONS = ["none", "secondary", "higher_secondary", "bachelor", "master"] as const;

type Step = 1 | 2 | 3 | 4;

interface WizardState {
  isc_sectors: string[];
  countries: string[];
  status: string;
  education: string;
}

function CountryCardGrid({
  options,
  selected,
  onChange,
  locale,
}: {
  options: typeof COUNTRIES;
  selected: string[];
  onChange: (next: string[]) => void;
  locale: "bn" | "en";
}) {
  const toggle = (optEn: string) => {
    onChange(
      selected.includes(optEn)
        ? selected.filter((s) => s !== optEn)
        : [...selected, optEn]
    );
  };

  return (
    <div className="grid gap-3 grid-cols-2">
      {options.map((country) => {
        const isSelected = selected.includes(country.en);
        return (
          <button
            key={country.en}
            type="button"
            onClick={() => toggle(country.en)}
            aria-pressed={isSelected}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all min-h-[52px] select-none",
              isSelected
                ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                : "border-slate-200 bg-white text-slate-700 hover:border-primary hover:text-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
            )}
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-current">
              {isSelected && <CheckCircle className="h-4 w-4 text-primary" />}
            </div>
            <div className="leading-tight">
              <span className="block font-semibold text-sm sm:text-base">
                {locale === "en" ? country.en : country.bn}
              </span>
              {locale !== "en" && (
                <span className="block text-[11px] text-muted-foreground font-normal">
                  {country.en}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ISCSectorGrid({
  selected,
  onChange,
  shakeKey,
  onLimitReached,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  shakeKey: string | null;
  onLimitReached?: (key: string) => void;
}) {
  const toggle = (key: string) => {
    if (selected.includes(key)) {
      onChange(selected.filter((s) => s !== key));
    } else if (selected.length >= 3) {
      onLimitReached?.(key);
      return;
    } else {
      onChange([...selected, key]);
    }
  };

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
      {ISC_SECTORS.map((sector) => {
        const isSelected = selected.includes(sector.key);
        const isShaking = shakeKey === sector.key;

        return (
          <button
            key={sector.key}
            type="button"
            onClick={() => toggle(sector.key)}
            aria-pressed={isSelected}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4 text-left transition-all min-h-[56px] select-none",
              isSelected
                ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                : "border-slate-200 bg-white text-slate-700 hover:border-primary hover:text-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
              isShaking && "animate-shake",
            )}
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-current">
              {isSelected && <CheckCircle className="h-4 w-4 text-primary" />}
            </div>
            <div className="leading-tight">
              <span className="block font-semibold text-sm sm:text-base">{sector.bn}</span>
              <span className="block text-[11px] text-muted-foreground font-normal">{sector.en}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SingleSelectList<T extends string>({
  options,
  selected,
  labelMap,
  onChange,
}: {
  options: readonly T[];
  selected: string;
  labelMap: (opt: T) => string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
      {options.map((opt) => {
        const isSelected = selected === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={isSelected}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4 text-left transition-all min-h-[56px] select-none",
              isSelected
                ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                : "border-slate-200 bg-white text-slate-700 hover:border-primary hover:text-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
            )}
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current">
              {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
            </div>
            <span className="font-semibold text-sm sm:text-base leading-tight">
              {labelMap(opt)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("onboarding");
  const locale = useLocale() as "bn" | "en";
  const [step, setStep] = useState<Step>(1);
  const [state, setState] = useState<WizardState>({
    isc_sectors: [],
    countries: [],
    status: "",
    education: "",
  });
  const [saving, setSaving] = useState(false);
  const [iscError, setIscError] = useState(false);
  const [shakeKey, setShakeKey] = useState<string | null>(null);
  const [iscLimitAlert, setIscLimitAlert] = useState(false);

  const { speak, stop, status: voiceStatus, isSupported } = useVoiceOutput(locale);

  const totalSteps = 4;
  const isEn = locale === "en";

  const steps = [
    {
      titleBn: UX_COPY.onboardingQuestions.step1Title.bn,
      titleEn: UX_COPY.onboardingQuestions.step1Title.en,
      subtitleBn: UX_COPY.onboardingQuestions.step1Subtitle.bn,
      subtitleEn: UX_COPY.onboardingQuestions.step1Subtitle.en,
    },
    {
      titleBn: UX_COPY.onboardingQuestions.step2Title.bn,
      titleEn: UX_COPY.onboardingQuestions.step2Title.en,
      subtitleBn: UX_COPY.onboardingQuestions.step2Subtitle.bn,
      subtitleEn: UX_COPY.onboardingQuestions.step2Subtitle.en,
    },
    {
      titleBn: UX_COPY.onboardingQuestions.step3Title.bn,
      titleEn: UX_COPY.onboardingQuestions.step3Title.en,
      subtitleBn: UX_COPY.onboardingQuestions.step3Subtitle.bn,
      subtitleEn: UX_COPY.onboardingQuestions.step3Subtitle.en,
    },
    {
      titleBn: UX_COPY.onboardingQuestions.step4Title.bn,
      titleEn: UX_COPY.onboardingQuestions.step4Title.en,
      subtitleBn: UX_COPY.onboardingQuestions.step4Subtitle.bn,
      subtitleEn: UX_COPY.onboardingQuestions.step4Subtitle.en,
    },
  ];

  const handleListen = () => {
    if (voiceStatus === "speaking") {
      stop();
      return;
    }
    const currentStep = steps[step - 1];
    const textToRead = isEn
      ? `${currentStep.titleEn}. ${currentStep.subtitleEn}`
      : `${currentStep.titleBn}। ${currentStep.subtitleBn}`;
    void speak(textToRead);
  };

  const handleIscChange = (next: string[]) => {
    if (next.length > 3) {
      const attempted = next.find((key) => !state.isc_sectors.includes(key));
      if (attempted) {
        handleIscLimit(attempted);
      }
      return;
    }

    setState((current) => ({ ...current, isc_sectors: next }));
    if (next.length >= 2) {
      setIscError(false);
    }
  };

  const handleIscLimit = (attempted: string) => {
    setIscLimitAlert(true);
    setShakeKey(attempted);
    setTimeout(() => setShakeKey(null), 600);
    setTimeout(() => setIscLimitAlert(false), 2200);
  };

  const handleNext = () => {
    if (step === 1 && state.isc_sectors.length < 2) {
      setIscError(true);
      return;
    }

    // Stop reading when moving to the next step
    stop();
    setIscError(false);
    setStep((current) => (current + 1) as Step);
  };

  const saveAndFinish = async (skipProfile = false) => {
    stop();
    setSaving(true);
    try {
      await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          skipProfile
            ? { onboarding_complete: true }
            : {
                preferred_sectors: state.isc_sectors,
                preferred_countries: state.countries,
                current_status: state.status || undefined,
                education_level: state.education || undefined,
                onboarding_complete: true,
              },
        ),
      });
    } finally {
      setSaving(false);
      const next = searchParams.get("next");
      const target = getSafeNextPath(next);
      router.push(target as Route);
      router.refresh();
    }
  };

  const canAdvance = step === 1 ? state.isc_sectors.length >= 2 : true;

  return (
    <div className="mx-auto max-w-xl">
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-4px)}
          40%{transform:translateX(4px)}
          60%{transform:translateX(-4px)}
          80%{transform:translateX(4px)}
        }
        .animate-shake { animation: shake 0.5s ease; }
      `}</style>

      {/* Progress Indicator */}
      <div className="mb-6">
        <div className="mb-2 flex justify-between text-xs font-semibold text-slate-400">
          <span>{t("stepOf", { current: step, total: totalSteps })}</span>
          <span>
            {locale === "bn"
              ? `${Math.round((step / totalSteps) * 100)}% সম্পন্ন`
              : `${Math.round((step / totalSteps) * 100)}% complete`}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-6 shadow-sm">
        {/* Step Header (Title, Subtitle, Voice button) */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 leading-tight">
              {steps[step - 1].titleBn}
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-350">
              {steps[step - 1].subtitleBn}
            </p>
            {isEn && (
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500 italic">
                {steps[step - 1].titleEn} — {steps[step - 1].subtitleEn}
              </p>
            )}
          </div>
          {isSupported && (
            <button
              type="button"
              onClick={handleListen}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold shadow-sm transition-all border shrink-0 select-none",
                voiceStatus === "speaking"
                  ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30"
                  : "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 dark:bg-primary/10 dark:text-primary-foreground"
              )}
              aria-label={locale === "bn" ? "প্রশ্নটি শুনুন" : "Listen to this question"}
            >
              {voiceStatus === "speaking" ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  <span>{locale === "bn" ? "থামান" : "Stop"}</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>{locale === "bn" ? "শুনুন" : "Listen"}</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Step Body */}
        {step === 1 && (
          <>
            {iscLimitAlert && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">
                    {locale === "bn"
                      ? "সর্বোচ্চ ৩টি কাজ বেছে নিতে পারবেন। আরেকটি যোগ করতে চাইলে আগে একটি বাদ দিন।"
                      : "You can choose up to 3 types of work. Remove one before adding another."}
                  </p>
                </div>
              </div>
            )}
            <ISCSectorGrid
              selected={state.isc_sectors}
              onChange={handleIscChange}
              shakeKey={shakeKey}
              onLimitReached={handleIscLimit}
            />
            {iscError && (
              <p className="mt-3 text-sm font-semibold text-red-600 flex items-center gap-1.5 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {locale === "bn" ? "কমপক্ষে ২টি কাজ বেছে নিন।" : "Please select at least 2 types of work."}
                </span>
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground font-medium">
              {locale === "bn"
                ? `নির্বাচিত: ${state.isc_sectors.length} / ৩`
                : `Selected: ${state.isc_sectors.length} / 3`}
            </p>
          </>
        )}

        {step === 2 && (
          <CountryCardGrid
            options={COUNTRIES}
            selected={state.countries}
            onChange={(countries) => setState((current) => ({ ...current, countries }))}
            locale={locale}
          />
        )}

        {step === 3 && (
          <SingleSelectList
            options={STATUS_OPTIONS}
            selected={state.status}
            labelMap={(opt) => t(`status.${opt}`)}
            onChange={(status) => setState((current) => ({ ...current, status }))}
          />
        )}

        {step === 4 && (
          <SingleSelectList
            options={EDUCATION_OPTIONS}
            selected={state.education}
            labelMap={(opt) => t(`education.${opt}`)}
            onChange={(education) => setState((current) => ({ ...current, education }))}
          />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-3">
          {step > 1 && (
            <Button variant="outline" className="h-11 px-5 text-sm font-bold" onClick={() => setStep((current) => (current - 1) as Step)}>
              {t("back")}
            </Button>
          )}
          <button
            className="h-11 px-4 text-sm text-slate-400 hover:text-slate-600 font-bold transition-colors select-none"
            onClick={() => saveAndFinish(true)}
          >
            {t("skip")}
          </button>
        </div>
        {step < totalSteps ? (
          <Button
            onClick={handleNext}
            disabled={step === 1 && !canAdvance}
            className={cn("h-11 px-6 text-sm font-bold", step === 1 && !canAdvance && "cursor-not-allowed opacity-50")}
          >
            {t("next")}
          </Button>
        ) : (
          <Button onClick={() => saveAndFinish(false)} disabled={saving} className="h-11 px-6 text-sm font-bold">
            {saving ? "..." : t("finish")}
          </Button>
        )}
      </div>
    </div>
  );
}
