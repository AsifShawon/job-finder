"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ISC_SECTORS = [
  { key: "informal_isc",       bn: "ইনফরমাল সেক্টর আইএসসি",                   en: "Informal Sector ISC" },
  { key: "ict_isc",            bn: "আইসিটি আইএসসি",                            en: "ICT ISC" },
  { key: "agrofood_isc",       bn: "অ্যাগ্রোফুড আইএসসি",                       en: "Agrofood ISC" },
  { key: "jute_isc",           bn: "জুট সেক্টর আইএসসি",                        en: "Jute Sector ISC" },
  { key: "ceramic_isc",        bn: "সিরামিক আইএসসি",                           en: "Ceramic ISC" },
  { key: "leather_isc",        bn: "লেদার ও লেদার গুডস আইএসসি",              en: "Leather & Leather Goods ISC" },
  { key: "light_eng_isc",      bn: "লাইট ইঞ্জিনিয়ারিং আইএসসি",              en: "Light Engineering ISC" },
  { key: "rgt_isc",            bn: "রেডিমেড গার্মেন্টস ও টেক্সটাইল আইএসসি", en: "Readymade Garments & Textile ISC" },
  { key: "pharma_isc",         bn: "ফার্মাসিউটিক্যাল আইএসসি",                 en: "Pharmaceutical ISC" },
  { key: "furniture_isc",      bn: "ফার্নিচার আইএসসি",                         en: "Furniture ISC" },
  { key: "plastics_isc",       bn: "প্লাস্টিকস আইএসসি",                        en: "Plastics ISC" },
  { key: "tourism_isc",        bn: "ট্যুরিজম ও হসপিটালিটি আইএসসি",           en: "Tourism & Hospitality ISC" },
  { key: "creative_media_isc", bn: "ক্রিয়েটিভ মিডিয়া আইএসসি",              en: "Creative Media ISC" },
  { key: "construction_isc",   bn: "কনস্ট্রাকশন আইএসসি",                       en: "Construction ISC" },
  { key: "agriculture_isc",    bn: "এগ্রিকালচার আইএসসি",                       en: "Agriculture ISC" },
];

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

const STATUS_OPTIONS = ["student", "employed", "unemployed", "seeking_migration", "other"] as const;
const EDUCATION_OPTIONS = ["none", "secondary", "higher_secondary", "bachelor", "master", "phd"] as const;

type Step = 1 | 2 | 3 | 4;

interface WizardState {
  isc_sectors: string[];
  countries: string[];
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

function ISCSectorGrid({
  selected,
  onChange,
  shakeKey,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  shakeKey: string | null;
}) {
  const locale = useLocale() as "bn" | "en";
  const toggle = (key: string) => {
    if (selected.includes(key)) {
      onChange(selected.filter((s) => s !== key));
    } else if (selected.length >= 3) {
      // max 3 — ignore, shake handled by parent via shakeKey
      return;
    } else {
      onChange([...selected, key]);
    }
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ISC_SECTORS.map((sector) => {
        const isSelected = selected.includes(sector.key);
        const isShaking = shakeKey === sector.key;
        return (
          <button
            key={sector.key}
            type="button"
            onClick={() => toggle(sector.key)}
            className={cn(
              "rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
              isSelected
                ? "border-primary bg-primary/5 text-primary"
                : "border-slate-200 bg-white text-slate-700 hover:border-primary hover:text-primary",
              isShaking && "animate-shake"
            )}
          >
            {isSelected && <CheckCircle className="mr-2 inline-block h-4 w-4 text-primary" />}
            <span className="block font-semibold">{sector.bn}</span>
            <span className="block text-xs text-muted-foreground">{sector.en}</span>
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
  const locale = useLocale() as "bn" | "en";
  const localizedCountries = COUNTRIES.map((item) => (locale === "en" ? item.en : item.bn));
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

  const TOTAL_STEPS = 4;

  const steps = [
    { title: t("step1Title"), subtitle: t("step1Subtitle") },
    { title: t("step2Title"), subtitle: t("step2Subtitle") },
    { title: t("step3Title"), subtitle: t("step3Subtitle") },
    { title: t("step4Title"), subtitle: t("step4Subtitle") },
  ];

  const handleIscChange = (next: string[]) => {
    if (next.length > 3) {
      // find the newly attempted key and shake it
      const attempted = next.find((k) => !state.isc_sectors.includes(k));
      if (attempted) {
        setShakeKey(attempted);
        setTimeout(() => setShakeKey(null), 600);
      }
      return;
    }
    setState((s) => ({ ...s, isc_sectors: next }));
    if (next.length >= 2) setIscError(false);
  };

  const handleNext = () => {
    if (step === 1 && state.isc_sectors.length < 2) {
      setIscError(true);
      return;
    }
    setIscError(false);
    setStep((s) => (s + 1) as Step);
  };

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
                preferred_sectors: state.isc_sectors,
                preferred_countries: state.countries,
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
          <>
            <ISCSectorGrid
              selected={state.isc_sectors}
              onChange={handleIscChange}
              shakeKey={shakeKey}
            />
            {iscError && (
              <p className="mt-3 text-sm font-medium text-red-600">
                {locale === "bn"
                  ? "কমপক্ষে ২টি সেক্টর বেছে নিন"
                  : "Please select at least 2 sectors"}
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              {locale === "bn"
                ? `নির্বাচিত: ${state.isc_sectors.length}/৩`
                : `Selected: ${state.isc_sectors.length}/3`}
            </p>
          </>
        )}

        {step === 2 && (
          <MultiSelectPill
            options={localizedCountries}
            selected={state.countries}
            onChange={(countries) => setState((s) => ({ ...s, countries }))}
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
          <Button
            onClick={handleNext}
            disabled={step === 1 && !canAdvance}
            className={cn(step === 1 && !canAdvance && "opacity-50 cursor-not-allowed")}
          >
            {t("next")}
          </Button>
        ) : (
          <Button onClick={() => saveAndFinish(false)} disabled={saving}>
            {saving ? "..." : t("finish")}
          </Button>
        )}
      </div>
    </div>
  );
}
