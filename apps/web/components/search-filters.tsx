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

const FILTER_LABELS = {
  q: { bn: "খোঁজ", en: "Search" },
  opportunity_type: { bn: "ধরন", en: "Type" },
  country: { bn: "দেশ", en: "Country" },
  isc_sector: { bn: "ক্যাটাগরি", en: "Category" },
  official_sources_only: { bn: "সরকারি উৎস", en: "Official only" },
  can_apply_from_bd: { bn: "বাংলাদেশ থেকে আবেদন", en: "Apply from BD" },
  deadline_within: { bn: "শেষ সময়", en: "Deadline" },
  salary_min: { bn: "বেতন", en: "Salary" },
  requires_existing_work_permit: { bn: "ওয়ার্ক পারমিট", en: "Work permit" },
} as const;

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
  typeCounts,
}: {
  values: FilterValues;
  setValues: React.Dispatch<React.SetStateAction<FilterValues>>;
  isEn: boolean;
  showMore: boolean;
  setShowMore: React.Dispatch<React.SetStateAction<boolean>>;
  categoriesOpen: boolean;
  setCategoriesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  typeCounts?: Record<string, number>;
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
            const countKey = value || "all";
            const count = typeof typeCounts?.[countKey] === "number" ? typeCounts?.[countKey] : undefined;
            const labelText = `${isEn ? en : bn}${typeof count === "number" ? ` (${count})` : ""}`;

            return (
              <button
                key={value || "all"}
                type="button"
                onClick={() => setValues((current) => ({ ...current, opportunity_type: value }))}
                className={cn(
                  "flex items-center gap-2 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition-all",
                  active
                    ? "border-primary bg-primary text-white shadow-md shadow-primary/20"
                    : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5",
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-white" : "text-primary")} />
                <span>{labelText}</span>
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
  typeCounts,
}: {
  isEn: boolean;
  initialValues: FilterValues;
  typeCounts?: Record<string, number>;
}) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(Boolean(initialValues.isc_sector));
  const [showMore, setShowMore] = useState(
    Boolean(initialValues.deadline_within || initialValues.salary_min || initialValues.lmia_status),
  );
  const [values, setValues] = useState(initialValues);

  const activeFilters = () => {
    const items: { key: keyof FilterValues; label: string; value?: string }[] = [];

    if (values.q) {
      items.push({
        key: "q",
        label: isEn ? FILTER_LABELS.q.en : FILTER_LABELS.q.bn,
        value: values.q,
      });
    }

    if (values.opportunity_type) {
      const type = TYPE_OPTIONS.find((option) => option.value === values.opportunity_type);
      items.push({
        key: "opportunity_type",
        label: isEn ? FILTER_LABELS.opportunity_type.en : FILTER_LABELS.opportunity_type.bn,
        value: type ? (isEn ? type.en : type.bn) : values.opportunity_type,
      });
    }

    if (values.country) {
      items.push({
        key: "country",
        label: isEn ? FILTER_LABELS.country.en : FILTER_LABELS.country.bn,
        value: values.country,
      });
    }

    if (values.isc_sector) {
      const sector = ISC_SECTORS.find((entry) => entry.key === values.isc_sector);
      items.push({
        key: "isc_sector",
        label: isEn ? FILTER_LABELS.isc_sector.en : FILTER_LABELS.isc_sector.bn,
        value: sector ? (isEn ? sector.en : sector.bn) : values.isc_sector,
      });
    }

    if (values.official_sources_only) {
      items.push({
        key: "official_sources_only",
        label: isEn ? FILTER_LABELS.official_sources_only.en : FILTER_LABELS.official_sources_only.bn,
      });
    }

    if (values.can_apply_from_bd) {
      items.push({
        key: "can_apply_from_bd",
        label: isEn ? FILTER_LABELS.can_apply_from_bd.en : FILTER_LABELS.can_apply_from_bd.bn,
      });
    }

    if (values.deadline_within) {
      const deadlineLabel =
        values.deadline_within === "7"
          ? isEn
            ? "Within 7 days"
            : "৭ দিনের মধ্যে"
          : isEn
            ? "Within 30 days"
            : "৩০ দিনের মধ্যে";
      items.push({
        key: "deadline_within",
        label: isEn ? FILTER_LABELS.deadline_within.en : FILTER_LABELS.deadline_within.bn,
        value: deadlineLabel,
      });
    }

    if (values.salary_min) {
      items.push({
        key: "salary_min",
        label: isEn ? FILTER_LABELS.salary_min.en : FILTER_LABELS.salary_min.bn,
        value: values.salary_min,
      });
    }

    if (values.requires_existing_work_permit) {
      items.push({
        key: "requires_existing_work_permit",
        label: isEn ? FILTER_LABELS.requires_existing_work_permit.en : FILTER_LABELS.requires_existing_work_permit.bn,
      });
    }

    return items;
  };

  const activeFilterItems = activeFilters();
  const activeFilterCount = activeFilterItems.length;

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

  const clearSingleFilter = (key: keyof FilterValues) => {
    setValues((current) => {
      const next = { ...current };

      if (
        key === "official_sources_only"
        || key === "can_apply_from_bd"
        || key === "requires_existing_work_permit"
      ) {
        next[key] = false;
      } else {
        next[key] = "" as FilterValues[typeof key];
      }

      return next;
    });
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
            typeCounts={typeCounts}
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
          <div className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-[2rem] bg-card">
            <div className="px-4 pt-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    {isEn ? "Filters" : "ফিল্টার"}
                  </p>
                  <h2 className="text-lg font-bold text-foreground">
                    {isEn ? "Find the right opportunity" : "সঠিক সুযোগ খুঁজুন"}
                  </h2>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {activeFilterItems.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {activeFilterItems.map((item) => (
                    <button
                      key={`${item.key}-${item.value ?? "on"}`}
                      type="button"
                      onClick={() => clearSingleFilter(item.key)}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                      aria-label={isEn ? "Remove filter" : "ফিল্টার সরান"}
                    >
                      <span>
                        {item.label}{item.value ? `: ${item.value}` : ""}
                      </span>
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                    aria-label={isEn ? "Clear all filters" : "সব ফিল্টার সরান"}
                  >
                    <X className="h-3 w-3" />
                    <span>{isEn ? "Clear all" : "সব মুছুন"}</span>
                  </button>
                </div>
              )}

              <FilterFields
                values={values}
                setValues={setValues}
                isEn={isEn}
                showMore={showMore}
                setShowMore={setShowMore}
                categoriesOpen={categoriesOpen}
                setCategoriesOpen={setCategoriesOpen}
                typeCounts={typeCounts}
              />
            </div>

            <div className="border-t border-border px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
              <button
                type="button"
                onClick={applyFilters}
                className="mb-3 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-white"
                aria-label={isEn ? "Apply filters" : "ফিল্টার প্রয়োগ করুন"}
              >
                {isEn ? `Apply (${activeFilterCount})` : `প্রয়োগ করুন (${activeFilterCount})`}
              </button>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="min-h-[52px] w-full rounded-xl border border-border px-4 text-sm font-semibold text-foreground"
                aria-label={isEn ? "Close filters" : "ফিল্টার বন্ধ করুন"}
              >
                {isEn ? "Close" : "বন্ধ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
