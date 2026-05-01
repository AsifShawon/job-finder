"use client";

import { useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  SlidersHorizontal,
  Stamp,
  X,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getISCSectorSearchParam, ISC_SECTORS } from "@/lib/isc-sectors";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS = [
  { value: "", icon: SlidersHorizontal, bn: "সব", en: "All" },
  { value: "overseas_job", icon: BriefcaseBusiness, bn: "প্রবাস চাকরি", en: "Overseas Jobs" },
  { value: "scholarship", icon: GraduationCap, bn: "স্কলারশিপ", en: "Scholarships" },
  { value: "migration_policy", icon: Stamp, bn: "ভিসা নীতি", en: "Visa Policy" },
] as const;

const COUNTRY_OPTIONS = [
  { bn: "মালয়েশিয়া", en: "Malaysia", value: "Malaysia" },
  { bn: "কানাডা", en: "Canada", value: "Canada" },
  { bn: "সৌদি আরব", en: "Saudi Arabia", value: "Saudi Arabia" },
  { bn: "জার্মানি", en: "Germany", value: "Germany" },
] as const;

type FilterValues = {
  q: string;
  opportunity_type: string;
  country: string;
  isc_sector: string;
  official_sources_only: boolean;
  can_apply_from_bd: boolean;
  deadline_within: string;
  salary_min: string;
  lmia_status: string;
  requires_existing_work_permit: boolean;
  sort: string;
};

function FilterFields({
  values,
  setValues,
  isEn,
  showMore,
  setShowMore,
  categoriesOpen,
  setCategoriesOpen,
}: {
  values: FilterValues;
  setValues: React.Dispatch<React.SetStateAction<FilterValues>>;
  isEn: boolean;
  showMore: boolean;
  setShowMore: React.Dispatch<React.SetStateAction<boolean>>;
  categoriesOpen: boolean;
  setCategoriesOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-foreground">
          {isEn ? "What are you looking for?" : "কি খুঁজছেন?"}
        </label>
        <Input
          value={values.q}
          onChange={(event) => setValues((current) => ({ ...current, q: event.target.value }))}
          placeholder={isEn ? "Warehouse, nurse, scholarship..." : "ওয়্যারহাউস, নার্স, স্কলারশিপ..."}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-foreground">
          {isEn ? "What kind of opportunity?" : "কী ধরনের সুযোগ?"}
        </label>
        <div className="grid gap-2">
          {TYPE_OPTIONS.map(({ value, icon: Icon, bn, en }) => {
            const active = values.opportunity_type === value;

            return (
              <button
                key={value || "all"}
                type="button"
                onClick={() => setValues((current) => ({ ...current, opportunity_type: value }))}
                className={cn(
                  "flex items-center gap-2 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-background text-foreground hover:border-primary hover:text-primary",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{isEn ? en : bn}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setCategoriesOpen((current) => !current)}
          className="flex w-full items-center justify-between text-left text-sm font-semibold text-foreground"
        >
          <span>{isEn ? "Categories" : "ক্যাটাগরি"}</span>
          {categoriesOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {categoriesOpen && (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {ISC_SECTORS.map((sector) => {
              const active = values.isc_sector === sector.key;

              return (
                <button
                  key={sector.key}
                  type="button"
                  onClick={() =>
                    setValues((current) => ({
                      ...current,
                      isc_sector: current.isc_sector === sector.key ? "" : sector.key,
                    }))
                  }
                  className={cn(
                    "w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                    active
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-background text-foreground hover:border-primary hover:text-primary",
                  )}
                >
                  <span className="block font-semibold">{sector.bn}</span>
                  <span className={cn("block text-xs", active ? "text-primary/80" : "text-muted-foreground")}>
                    {sector.en}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-foreground">
          {isEn ? "Which country?" : "কোন দেশে?"}
        </label>
        <Input
          value={values.country}
          onChange={(event) => setValues((current) => ({ ...current, country: event.target.value }))}
          placeholder={isEn ? "Canada, Germany, Malaysia..." : "কানাডা, জার্মানি, মালয়েশিয়া..."}
        />
        <div className="flex flex-wrap gap-2">
          {COUNTRY_OPTIONS.map(({ bn, en, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => setValues((current) => ({ ...current, country: value }))}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                values.country === value
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-background text-foreground hover:border-primary hover:text-primary",
              )}
            >
              {isEn ? en : bn}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {isEn ? "Apply directly from Bangladesh" : "বাংলাদেশ থেকে সরাসরি আবেদন করা যাবে"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isEn
              ? "Show opportunities suitable for Bangladeshi applicants"
              : "বাংলাদেশি আবেদনকারীদের জন্য উপযোগী সুযোগ দেখান"}
          </p>
        </div>
        <input
          type="checkbox"
          checked={values.can_apply_from_bd}
          onChange={(event) =>
            setValues((current) => ({ ...current, can_apply_from_bd: event.target.checked }))
          }
          className="h-5 w-5 accent-primary"
        />
      </label>

      <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {isEn ? "Official sources only" : "শুধু সরকারি বা অফিসিয়াল উৎস"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isEn ? "Prioritize highly trusted listings" : "সবচেয়ে বিশ্বস্ত উৎসের তালিকা আগে দেখান"}
          </p>
        </div>
        <input
          type="checkbox"
          checked={values.official_sources_only}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              official_sources_only: event.target.checked,
            }))
          }
          className="h-5 w-5 accent-primary"
        />
      </label>

      <div className="rounded-2xl border border-border bg-background p-4">
        <button
          type="button"
          onClick={() => setShowMore((current) => !current)}
          className="flex w-full items-center justify-between text-sm font-semibold text-foreground"
        >
          <span>{isEn ? "More filters" : "আরও ফিল্টার"}</span>
          <span>{showMore ? "−" : "+"}</span>
        </button>

        {showMore && (
          <div className="mt-4 grid gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">
                {isEn ? "Deadline within" : "কত দিনের মধ্যে শেষ"}
              </label>
              <select
                value={values.deadline_within}
                onChange={(event) =>
                  setValues((current) => ({ ...current, deadline_within: event.target.value }))
                }
                className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground"
              >
                <option value="">{isEn ? "Any time" : "যেকোনো সময়"}</option>
                <option value="7">{isEn ? "Within 7 days" : "৭ দিনের মধ্যে"}</option>
                <option value="30">{isEn ? "Within 30 days" : "৩০ দিনের মধ্যে"}</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">
                {isEn ? "Minimum salary" : "সর্বনিম্ন বেতন"}
              </label>
              <Input
                type="number"
                value={values.salary_min}
                onChange={(event) => setValues((current) => ({ ...current, salary_min: event.target.value }))}
                placeholder={isEn ? "Example: 2500" : "যেমন: ২৫০০"}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SearchFilters({
  isEn,
  initialValues,
}: {
  isEn: boolean;
  initialValues: FilterValues;
}) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(Boolean(initialValues.isc_sector));
  const [showMore, setShowMore] = useState(
    Boolean(initialValues.deadline_within || initialValues.salary_min || initialValues.lmia_status),
  );
  const [values, setValues] = useState(initialValues);

  const applyFilters = () => {
    const params = new URLSearchParams();

    if (values.q) params.set("q", values.q);
    if (values.opportunity_type) params.set("opportunity_type", values.opportunity_type);
    if (values.country) params.set("country", values.country);
    if (values.isc_sector) params.set("sector", getISCSectorSearchParam(values.isc_sector));
    if (values.official_sources_only) params.set("official_sources_only", "true");
    if (values.can_apply_from_bd) params.set("can_apply_from_bd", "true");
    if (values.deadline_within) params.set("deadline_within", values.deadline_within);
    if (values.salary_min) params.set("salary_min", values.salary_min);
    if (values.lmia_status) params.set("lmia_status", values.lmia_status);
    if (values.requires_existing_work_permit) params.set("requires_existing_work_permit", "true");
    if (values.sort) params.set("sort", values.sort);

    router.push((`/search${params.toString() ? `?${params.toString()}` : ""}`) as Route);
    setMobileOpen(false);
  };

  const clearFilters = () => {
    const resetValues = {
      ...initialValues,
      q: "",
      opportunity_type: "",
      country: "",
      isc_sector: "",
      official_sources_only: false,
      can_apply_from_bd: false,
      deadline_within: "",
      salary_min: "",
      lmia_status: "",
      requires_existing_work_permit: false,
    };

    setValues(resetValues);
    setCategoriesOpen(false);
    router.push((values.sort ? `/search?sort=${values.sort}` : "/search") as Route);
    setMobileOpen(false);
  };

  return (
    <>
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-card"
        >
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <span>{isEn ? "Show filters" : "ফিল্টার দেখুন"}</span>
        </button>
      </div>

      <aside className="hidden lg:block">
        <Card className="sticky top-32">
          <div className="mb-4 flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              {isEn ? "Filters" : "ফিল্টার"}
            </h2>
          </div>
          <FilterFields
            values={values}
            setValues={setValues}
            isEn={isEn}
            showMore={showMore}
            setShowMore={setShowMore}
            categoriesOpen={categoriesOpen}
            setCategoriesOpen={setCategoriesOpen}
          />
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={applyFilters}
              className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white"
            >
              {isEn ? "Apply Filters" : "প্রয়োগ করুন"}
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground"
            >
              {isEn ? "Clear All" : "সব মুছুন"}
            </button>
          </div>
        </Card>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[70] bg-[#07152f]/70 lg:hidden">
          <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-[2rem] bg-card px-4 pb-6 pt-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  {isEn ? "Filters" : "ফিল্টার"}
                </p>
                <h2 className="text-lg font-bold text-foreground">
                  {isEn ? "Find the right opportunity" : "সঠিক সুযোগ খুঁজুন"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                <span>{isEn ? "Close" : "বন্ধ"}</span>
              </button>
            </div>

            <FilterFields
              values={values}
              setValues={setValues}
              isEn={isEn}
              showMore={showMore}
              setShowMore={setShowMore}
              categoriesOpen={categoriesOpen}
              setCategoriesOpen={setCategoriesOpen}
            />

            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={applyFilters}
                className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white"
              >
                {isEn ? "Apply Filters" : "প্রয়োগ করুন"}
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground"
              >
                {isEn ? "Clear All" : "সব মুছুন"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
