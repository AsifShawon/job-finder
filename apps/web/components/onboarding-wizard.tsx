"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COUNTRIES = [
  { en: "Malaysia", bn: "মালয়েশিয়া" },
  { en: "Saudi Arabia", bn: "সৌদি আরব" },
  { en: "Qatar", bn: "কাতার" },
  { en: "United Arab Emirates", bn: "সংযুক্ত আরব আমিরাত" },
  { en: "Kuwait", bn: "কুয়েত" },
  { en: "Bahrain", bn: "বাহরাইন" },
  { en: "Oman", bn: "ওমান" },
  { en: "Singapore", bn: "সিঙ্গাপুর" },
  { en: "South Korea", bn: "দক্ষিণ কোরিয়া" },
  { en: "Japan", bn: "জাপান" },
  { en: "Italy", bn: "ইতালি" },
  { en: "United Kingdom", bn: "যুক্তরাজ্য" },
  { en: "Canada", bn: "কানাডা" },
  { en: "Australia", bn: "অস্ট্রেলিয়া" },
  { en: "Germany", bn: "জার্মানি" },
];

const SECTORS = [
  { en: "IT", bn: "আইটি" },
  { en: "Healthcare", bn: "স্বাস্থ্যসেবা" },
  { en: "Construction", bn: "নির্মাণ" },
  { en: "Education", bn: "শিক্ষা" },
  { en: "Hospitality", bn: "হসপিটালিটি" },
  { en: "Manufacturing", bn: "উৎপাদন" },
  { en: "Agriculture", bn: "কৃষি" },
  { en: "Transport", bn: "পরিবহন" },
  { en: "Finance", bn: "অর্থনীতি" },
  { en: "Engineering", bn: "ইঞ্জিনিয়ারিং" },
  { en: "Domestic work", bn: "গৃহকর্ম" },
  { en: "Security", bn: "নিরাপত্তা" },
  { en: "Garments", bn: "পোশাকশিল্প" },
  { en: "Retail", bn: "খুচরা বিক্রয়" },
];

const STATUS_OPTIONS = ["student", "employed", "unemployed", "seeking_migration", "other"] as const;
const EDUCATION_OPTIONS = ["none", "secondary", "higher_secondary", "bachelor", "master", "phd"] as const;

type Step = 1 | 2 | 3 | 4;

interface WizardState {
  countries: string[];
  sectors: string[];
  status: string;
  education: string;
}

function MultiSelectPill({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
            selected.includes(opt)
              ? "border-primary bg-primary text-white"
              : "border-slate-200 bg-white text-slate-700 hover:border-primary hover:text-primary"
          )}
        >
          {selected.includes(opt) && <CheckCircle className="mr-1 inline-block h-3.5 w-3.5" />}
          {opt}
        </button>
      ))}
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
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
            selected === opt
              ? "border-primary bg-primary/5 text-primary"
              : "border-slate-200 bg-white text-slate-700 hover:border-primary hover:text-primary"
          )}
        >
          {selected === opt && <CheckCircle className="mr-2 inline-block h-4 w-4 text-primary" />}
          {labelMap(opt)}
        </button>
      ))}
    </div>
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const t = useTranslations("onboarding");
  const locale = useLocale();
  const localizedCountries = COUNTRIES.map((item) => (locale === "en" ? item.en : item.bn));
  const localizedSectors = SECTORS.map((item) => (locale === "en" ? item.en : item.bn));
  const [step, setStep] = useState<Step>(1);
  const [state, setState] = useState<WizardState>({
    countries: [],
    sectors: [],
    status: "",
    education: "",
  });
  const [saving, setSaving] = useState(false);

  const TOTAL_STEPS = 4;

  const steps = [
    { title: t("step1Title"), subtitle: t("step1Subtitle") },
    { title: t("step2Title"), subtitle: t("step2Subtitle") },
    { title: t("step3Title"), subtitle: t("step3Subtitle") },
    { title: t("step4Title"), subtitle: t("step4Subtitle") },
  ];

  const saveAndFinish = async (skipProfile = false) => {
    setSaving(true);
    try {
      await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          skipProfile
            ? { onboarding_complete: true }
            : {
                preferred_countries: state.countries,
                preferred_sectors: state.sectors,
                current_status: state.status || undefined,
                education_level: state.education || undefined,
                onboarding_complete: true,
              }
        ),
      });
    } finally {
      setSaving(false);
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="mb-2 flex justify-between text-xs text-slate-400">
          <span>{steps[step - 1].title}</span>
          <span>{t("stepOf", { current: step, total: TOTAL_STEPS })}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-xl font-bold">{steps[step - 1].title}</h2>
        <p className="mb-6 text-sm text-slate-500">{steps[step - 1].subtitle}</p>

        {step === 1 && (
          <MultiSelectPill
            options={localizedCountries}
            selected={state.countries}
            onChange={(countries) => setState((s) => ({ ...s, countries }))}
          />
        )}

        {step === 2 && (
          <MultiSelectPill
            options={localizedSectors}
            selected={state.sectors}
            onChange={(sectors) => setState((s) => ({ ...s, sectors }))}
          />
        )}

        {step === 3 && (
          <SingleSelectList
            options={STATUS_OPTIONS}
            selected={state.status}
            labelMap={(opt) => t(`status.${opt}`)}
            onChange={(status) => setState((s) => ({ ...s, status }))}
          />
        )}

        {step === 4 && (
          <SingleSelectList
            options={EDUCATION_OPTIONS}
            selected={state.education}
            labelMap={(opt) => t(`education.${opt}`)}
            onChange={(education) => setState((s) => ({ ...s, education }))}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-3">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)}>
              {t("back")}
            </Button>
          )}
          <button
            className="text-sm text-slate-400 hover:text-slate-600"
            onClick={() => saveAndFinish(true)}
          >
            {t("skip")}
          </button>
        </div>
        {step < TOTAL_STEPS ? (
          <Button onClick={() => setStep((s) => (s + 1) as Step)}>{t("next")}</Button>
        ) : (
          <Button onClick={() => saveAndFinish(false)} disabled={saving}>
            {saving ? "..." : t("finish")}
          </Button>
        )}
      </div>
    </div>
  );
}
