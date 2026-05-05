"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Download, Loader2, PenLine, Sparkles, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ManualEntryResponse {
  id: number;
}

interface BulkImportError {
  row: number;
  detail: string;
}

interface ManualBulkImportResponse {
  created: number;
  updated: number;
  skipped: number;
  errors: BulkImportError[];
  draft_ids: number[];
}

interface FormState {
  title: string;
  source_url: string;
  raw_description: string;
  source_name: string;
  country: string;
  employer: string;
  deadline: string;
  opportunity_type: string;
  run_ai_extraction: boolean;
  title_bn: string;
  summary_bn: string;
  summary_en: string;
  sector: string;
  degree_level: string;
  salary_min: string;
  salary_max: string;
  salary_currency: string;
  application_url: string;
  eligibility_text: string;
  visa_support: string;
  can_apply_from_bd: string;
  requirements: string;
  benefits: string;
  language_requirements: string;
  journey_steps: string;
  documents_needed: string;
  typical_salary_bdt: string;
}

const DEFAULT_FORM: FormState = {
  title: "",
  source_url: "",
  raw_description: "",
  source_name: "",
  country: "",
  employer: "",
  deadline: "",
  opportunity_type: "overseas_job",
  run_ai_extraction: true,
  title_bn: "",
  summary_bn: "",
  summary_en: "",
  sector: "",
  degree_level: "",
  salary_min: "",
  salary_max: "",
  salary_currency: "",
  application_url: "",
  eligibility_text: "",
  visa_support: "",
  can_apply_from_bd: "",
  requirements: "",
  benefits: "",
  language_requirements: "",
  journey_steps: "",
  documents_needed: "",
  typical_salary_bdt: "",
};

const REQUIRED_COLUMNS = [
  { key: "title", example: "Welder - Japan" },
  { key: "source_url", example: "https://example.com/job/123" },
  { key: "raw_description", example: "Paste the full vacancy text" },
];

const OPTIONAL_COLUMNS = [
  "source_name",
  "country",
  "employer",
  "deadline",
  "opportunity_type",
  "title_bn",
  "summary_bn",
  "summary_en",
  "sector",
  "degree_level",
  "salary_min",
  "salary_max",
  "salary_currency",
  "application_url",
  "eligibility_text",
  "visa_support",
  "can_apply_from_bd",
  "requirements",
  "benefits",
  "language_requirements",
  "journey_steps",
  "documents_needed",
  "typical_salary_bdt",
];

function optionalText(value: string): string | undefined {
  const cleaned = value.trim();
  return cleaned || undefined;
}

function optionalNumber(value: string): number | undefined {
  const cleaned = value.trim();
  if (!cleaned) {
    return undefined;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalInteger(value: string): number | undefined {
  const parsed = optionalNumber(value);
  return parsed == null ? undefined : Math.trunc(parsed);
}

function optionalBoolean(value: string): boolean | undefined {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

function optionalList(value: string): string[] | undefined {
  const items = value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export function AdminManualEntryForm({ isEn }: { isEn: boolean }) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [busy, setBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkRunAi, setBulkRunAi] = useState(true);
  const [bulkResult, setBulkResult] = useState<ManualBulkImportResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!showToast) {
      return undefined;
    }
    const timer = window.setTimeout(() => setShowToast(false), 4500);
    return () => window.clearTimeout(timer);
  }, [showToast]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const body = {
        title: form.title,
        source_url: form.source_url,
        raw_description: form.raw_description,
        source_name: optionalText(form.source_name),
        country: optionalText(form.country),
        employer: optionalText(form.employer),
        deadline: optionalText(form.deadline),
        opportunity_type: form.opportunity_type,
        run_ai_extraction: form.run_ai_extraction,
        title_bn: optionalText(form.title_bn),
        summary_bn: optionalText(form.summary_bn),
        summary_en: optionalText(form.summary_en),
        sector: optionalText(form.sector),
        degree_level: optionalText(form.degree_level),
        salary_min: optionalNumber(form.salary_min),
        salary_max: optionalNumber(form.salary_max),
        salary_currency: optionalText(form.salary_currency),
        application_url: optionalText(form.application_url),
        eligibility_text: optionalText(form.eligibility_text),
        visa_support: optionalBoolean(form.visa_support),
        can_apply_from_bd: optionalBoolean(form.can_apply_from_bd),
        requirements: optionalList(form.requirements),
        benefits: optionalList(form.benefits),
        language_requirements: optionalList(form.language_requirements),
        journey_steps: optionalList(form.journey_steps),
        documents_needed: optionalList(form.documents_needed),
        typical_salary_bdt: optionalInteger(form.typical_salary_bdt),
      };
      const response = await fetch("/api/admin/manual-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as ManualEntryResponse & { detail?: string };
      if (!response.ok) {
        setError(payload.detail || (isEn ? "Could not create draft." : "ড্রাফট তৈরি করা যায়নি।"));
        return;
      }
      setCreatedId(payload.id);
      setShowToast(true);
      setForm(DEFAULT_FORM);
    } finally {
      setBusy(false);
    }
  };

  const submitBulk = async () => {
    if (!bulkFile) {
      setBulkError(isEn ? "Choose a CSV or XLSX file first." : "আগে একটি CSV বা XLSX ফাইল নির্বাচন করুন।");
      return;
    }

    setBulkBusy(true);
    setBulkError("");
    setBulkResult(null);
    try {
      const formData = new FormData();
      formData.append("file", bulkFile);
      formData.append("run_ai_extraction", String(bulkRunAi));

      const response = await fetch("/api/admin/manual-entry/bulk", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as ManualBulkImportResponse & { detail?: string };
      if (!response.ok) {
        setBulkError(payload.detail || (isEn ? "Could not import the file." : "ফাইল ইমপোর্ট করা যায়নি।"));
        return;
      }
      setBulkResult(payload);
      setBulkFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {showToast && createdId && (
        <div className="fixed right-4 top-4 z-50 max-w-sm rounded-2xl border border-emerald-200 bg-white p-4 shadow-xl dark:border-emerald-700/30 dark:bg-slate-950">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            {isEn
              ? `Draft #${createdId} created — go to Review Queue to approve`
              : `ড্রাফট #${createdId} তৈরি হয়েছে — অনুমোদনের জন্য রিভিউ কিউতে যান`}
          </p>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <Link href="/admin/review" className="font-semibold text-primary hover:underline">
              {isEn ? "Open Review Queue" : "রিভিউ কিউ খুলুন"}
            </Link>
            <button
              type="button"
              onClick={() => setShowToast(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              {isEn ? "Dismiss" : "বন্ধ করুন"}
            </button>
          </div>
        </div>
      )}

      <Card className="p-5">
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            {isEn
              ? "Admin-only intake. Single entries and bulk uploads both create pending drafts that must be approved from the review queue."
              : "এটি admin-only intake। একক এন্ট্রি এবং bulk upload দুটিই pending draft তৈরি করবে, যা review queue থেকে approve করতে হবে।"}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">
              {isEn ? "Job Title *" : "জব টাইটেল *"}
            </span>
            <Input value={form.title} onChange={(event) => setField("title", event.target.value)} />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">
              {isEn ? "Country" : "দেশ"}
            </span>
            <Input value={form.country} onChange={(event) => setField("country", event.target.value)} />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">
              {isEn ? "Source URL *" : "সোর্স URL *"}
            </span>
            <Input value={form.source_url} onChange={(event) => setField("source_url", event.target.value)} />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">
              {isEn ? "Employer / Organization" : "নিয়োগকর্তা / প্রতিষ্ঠান"}
            </span>
            <Input value={form.employer} onChange={(event) => setField("employer", event.target.value)} />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">
              {isEn ? "Source Name" : "সোর্স নাম"}
            </span>
            <Input value={form.source_name} onChange={(event) => setField("source_name", event.target.value)} />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">
              {isEn ? "Deadline" : "ডেডলাইন"}
            </span>
            <Input type="date" value={form.deadline} onChange={(event) => setField("deadline", event.target.value)} />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">
              {isEn ? "Opportunity Type" : "অপর্চুনিটি টাইপ"}
            </span>
            <select
              value={form.opportunity_type}
              onChange={(event) => setField("opportunity_type", event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="overseas_job">{isEn ? "Overseas Job" : "প্রবাস চাকরি"}</option>
              <option value="local_job">{isEn ? "Local Job" : "স্থানীয় চাকরি"}</option>
              <option value="training">{isEn ? "Training" : "প্রশিক্ষণ"}</option>
              <option value="scholarship">{isEn ? "Scholarship" : "স্কলারশিপ"}</option>
            </select>
          </label>

          <label className="flex items-center gap-3 pt-7 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={form.run_ai_extraction}
              onChange={(event) => setField("run_ai_extraction", event.target.checked)}
              className="h-4 w-4 rounded accent-primary"
            />
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {isEn ? "Run AI Extraction" : "AI Extraction চালু রাখুন"}
            </span>
          </label>
        </div>

        <label className="mt-5 block space-y-1.5">
          <span className="text-sm font-semibold text-foreground">
            {isEn ? "Raw Job Description *" : "র’ জব ডেসক্রিপশন *"}
          </span>
          <textarea
            value={form.raw_description}
            onChange={(event) => setField("raw_description", event.target.value)}
            placeholder={isEn
              ? "Paste the full job posting text here, in any language."
              : "পূর্ণ চাকরির বিবরণ এখানে পেস্ট করুন, যে কোনো ভাষায়।"}
            className="min-h-[280px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <details
          open={!form.run_ai_extraction}
          className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/30"
        >
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            {isEn ? "Optional Structured Fields" : "ঐচ্ছিক Structured Fields"}
          </summary>
          <p className="mt-2 text-sm text-muted-foreground">
            {isEn
              ? "These are usually filled by AI. Use them when AI extraction is off, or when you want to supply missing structured details manually."
              : "এগুলো সাধারণত AI পূরণ করে। AI extraction বন্ধ থাকলে, বা নিজে অতিরিক্ত structured তথ্য দিতে চাইলে এগুলো ব্যবহার করুন।"}
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{isEn ? "Bangla Title" : "বাংলা শিরোনাম"}</span>
              <Input value={form.title_bn} onChange={(event) => setField("title_bn", event.target.value)} />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{isEn ? "Sector" : "সেক্টর"}</span>
              <Input value={form.sector} onChange={(event) => setField("sector", event.target.value)} />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{isEn ? "English Summary" : "ইংরেজি সারসংক্ষেপ"}</span>
              <textarea
                value={form.summary_en}
                onChange={(event) => setField("summary_en", event.target.value)}
                className="min-h-[120px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{isEn ? "Bangla Summary" : "বাংলা সারসংক্ষেপ"}</span>
              <textarea
                value={form.summary_bn}
                onChange={(event) => setField("summary_bn", event.target.value)}
                className="min-h-[120px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{isEn ? "Degree Level" : "শিক্ষাগত স্তর"}</span>
              <Input value={form.degree_level} onChange={(event) => setField("degree_level", event.target.value)} />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{isEn ? "Application URL" : "আবেদনের URL"}</span>
              <Input value={form.application_url} onChange={(event) => setField("application_url", event.target.value)} />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{isEn ? "Salary Min" : "সর্বনিম্ন বেতন"}</span>
              <Input type="number" min="0" value={form.salary_min} onChange={(event) => setField("salary_min", event.target.value)} />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{isEn ? "Salary Max" : "সর্বোচ্চ বেতন"}</span>
              <Input type="number" min="0" value={form.salary_max} onChange={(event) => setField("salary_max", event.target.value)} />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{isEn ? "Salary Currency" : "বেতনের মুদ্রা"}</span>
              <Input placeholder="SAR / AED / USD / BDT" value={form.salary_currency} onChange={(event) => setField("salary_currency", event.target.value)} />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{isEn ? "Typical Salary in BDT" : "আনুমানিক বেতন (BDT)"}</span>
              <Input type="number" min="0" value={form.typical_salary_bdt} onChange={(event) => setField("typical_salary_bdt", event.target.value)} />
            </label>

            <label className="space-y-1.5 md:col-span-2">
              <span className="text-sm font-semibold text-foreground">{isEn ? "Eligibility Text" : "যোগ্যতার বিবরণ"}</span>
              <textarea
                value={form.eligibility_text}
                onChange={(event) => setField("eligibility_text", event.target.value)}
                className="min-h-[120px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{isEn ? "Visa Support" : "ভিসা সহায়তা"}</span>
              <select
                value={form.visa_support}
                onChange={(event) => setField("visa_support", event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{isEn ? "Let system decide" : "সিস্টেম ঠিক করুক"}</option>
                <option value="true">{isEn ? "Yes" : "হ্যাঁ"}</option>
                <option value="false">{isEn ? "No" : "না"}</option>
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{isEn ? "Can Apply from Bangladesh" : "বাংলাদেশ থেকে আবেদন করা যাবে"}</span>
              <select
                value={form.can_apply_from_bd}
                onChange={(event) => setField("can_apply_from_bd", event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{isEn ? "Let system decide" : "সিস্টেম ঠিক করুক"}</option>
                <option value="true">{isEn ? "Yes" : "হ্যাঁ"}</option>
                <option value="false">{isEn ? "No" : "না"}</option>
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{isEn ? "Requirements" : "শর্তাবলি"}</span>
              <textarea
                value={form.requirements}
                onChange={(event) => setField("requirements", event.target.value)}
                placeholder={isEn ? "One item per line" : "প্রতি লাইনে একটি আইটেম"}
                className="min-h-[140px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{isEn ? "Benefits" : "সুবিধাসমূহ"}</span>
              <textarea
                value={form.benefits}
                onChange={(event) => setField("benefits", event.target.value)}
                placeholder={isEn ? "One item per line" : "প্রতি লাইনে একটি আইটেম"}
                className="min-h-[140px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{isEn ? "Language Requirements" : "ভাষাগত শর্ত"}</span>
              <textarea
                value={form.language_requirements}
                onChange={(event) => setField("language_requirements", event.target.value)}
                placeholder={isEn ? "One item per line" : "প্রতি লাইনে একটি আইটেম"}
                className="min-h-[140px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{isEn ? "Journey Steps" : "আবেদনের ধাপ"}</span>
              <textarea
                value={form.journey_steps}
                onChange={(event) => setField("journey_steps", event.target.value)}
                placeholder={isEn ? "One step per line" : "প্রতি লাইনে একটি ধাপ"}
                className="min-h-[140px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="space-y-1.5 md:col-span-2">
              <span className="text-sm font-semibold text-foreground">{isEn ? "Documents Needed" : "প্রয়োজনীয় কাগজপত্র"}</span>
              <textarea
                value={form.documents_needed}
                onChange={(event) => setField("documents_needed", event.target.value)}
                placeholder={isEn ? "One document per line" : "প্রতি লাইনে একটি কাগজপত্র"}
                className="min-h-[140px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
        </details>

        {error && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            onClick={submit}
            disabled={busy || !form.title || !form.source_url || !form.raw_description}
            className="min-w-[220px]"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PenLine className="mr-2 h-4 w-4" />}
            {busy
              ? (isEn ? "Creating Draft..." : "ড্রাফট তৈরি হচ্ছে...")
              : (isEn ? "Add to Review Queue" : "রিভিউ কিউতে যোগ করুন")}
          </Button>

          <Link href="/admin/review" className="text-sm font-semibold text-primary hover:underline">
            {isEn ? "Go to Review Queue" : "রিভিউ কিউতে যান"}
          </Link>

          <button
            type="button"
            onClick={() => {
              setForm(DEFAULT_FORM);
              setError("");
              setShowToast(false);
            }}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {isEn ? "Add Another" : "আরেকটি যোগ করুন"}
          </button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <Card className="p-5">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {isEn ? "Bulk Draft Import" : "বাল্ক ড্রাফট ইমপোর্ট"}
            </p>
            <h2 className="mt-1 text-xl font-bold text-foreground">
              {isEn ? "Upload CSV or Excel" : "CSV বা Excel আপলোড করুন"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isEn
                ? "Upload one spreadsheet and create or update many manual-entry drafts in a single step."
                : "একটি spreadsheet আপলোড করে এক ধাপে অনেক manual-entry draft তৈরি বা আপডেট করুন।"}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(event) => setBulkFile(event.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                {bulkFile ? (isEn ? "Change file" : "ফাইল পরিবর্তন করুন") : (isEn ? "Choose file" : "ফাইল নির্বাচন করুন")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {bulkFile?.name || (isEn ? "No file selected yet." : "এখনও কোনো ফাইল নির্বাচন করা হয়নি।")}
              </span>
            </div>

            <label className="flex items-center gap-3 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={bulkRunAi}
                onChange={(event) => setBulkRunAi(event.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {isEn ? "Run AI Extraction for all rows" : "সব row-এর জন্য AI Extraction চালু রাখুন"}
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={submitBulk} disabled={bulkBusy || !bulkFile}>
                {bulkBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {bulkBusy ? (isEn ? "Importing..." : "ইমপোর্ট হচ্ছে...") : (isEn ? "Upload to Review Queue" : "রিভিউ কিউতে আপলোড করুন")}
              </Button>
              <a
                href="/api/admin/manual-entry/template"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                <Download className="h-4 w-4" />
                {isEn ? "Download template" : "টেমপ্লেট ডাউনলোড করুন"}
              </a>
            </div>

            {bulkError && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
                {bulkError}
              </p>
            )}

            {bulkResult && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-700/30 dark:bg-emerald-900/10">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  {isEn
                    ? `Created ${bulkResult.created}, updated ${bulkResult.updated}, skipped ${bulkResult.skipped}.`
                    : `তৈরি হয়েছে ${bulkResult.created}, আপডেট হয়েছে ${bulkResult.updated}, বাদ গেছে ${bulkResult.skipped}।`}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <Link href="/admin/review" className="font-semibold text-primary hover:underline">
                    {isEn ? "Open Review Queue" : "রিভিউ কিউ খুলুন"}
                  </Link>
                  {bulkResult.draft_ids.length > 0 && (
                    <span className="text-muted-foreground">
                      {isEn ? `${bulkResult.draft_ids.length} draft IDs returned.` : `${bulkResult.draft_ids.length}টি draft ID পাওয়া গেছে।`}
                    </span>
                  )}
                </div>
                {bulkResult.errors.length > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-white/80 p-3 text-sm dark:bg-slate-950/30">
                    <p className="font-semibold text-amber-700 dark:text-amber-300">
                      {isEn ? "Rows with issues" : "যে row-গুলোতে সমস্যা আছে"}
                    </p>
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      {bulkResult.errors.map((item) => (
                        <li key={`${item.row}-${item.detail}`}>
                          {isEn ? "Row" : "Row"} {item.row}: {item.detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {isEn ? "Sheet Guide" : "শিট গাইড"}
            </p>
            <h2 className="mt-1 text-xl font-bold text-foreground">
              {isEn ? "Required and Optional Columns" : "প্রয়োজনীয় ও ঐচ্ছিক কলাম"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isEn
                ? "Use the exact header names below. AI extraction, when enabled, applies to the whole uploaded file."
                : "নিচের header নামগুলো হুবহু ব্যবহার করুন। AI extraction চালু থাকলে তা পুরো আপলোড করা ফাইলে প্রযোজ্য হবে।"}
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {isEn ? "Required" : "প্রয়োজনীয়"}
              </h3>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {REQUIRED_COLUMNS.map((column) => (
                  <li key={column.key} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                    <span className="font-semibold text-foreground">{column.key}</span>
                    <span className="block text-xs text-muted-foreground">{column.example}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {isEn ? "Optional" : "ঐচ্ছিক"}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {OPTIONAL_COLUMNS.map((column) => (
                  <span
                    key={column}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300"
                  >
                    {column}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-950/40">
              <p className="font-semibold text-foreground">
                {isEn ? "List field format" : "লিস্ট ফিল্ডের ফরম্যাট"}
              </p>
              <p className="mt-1">
                {isEn
                  ? "For requirements, benefits, language_requirements, journey_steps, and documents_needed, put one item per line inside a cell. Comma-separated fallback is also accepted."
                  : "requirements, benefits, language_requirements, journey_steps এবং documents_needed ফিল্ডে প্রতি cell-এ এক লাইনে একটি item দিন। comma-separated fallback-ও কাজ করবে।"}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
