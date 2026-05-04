"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, PenLine, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ManualEntryResponse {
  id: number;
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
};

export function AdminManualEntryForm({ isEn }: { isEn: boolean }) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [showToast, setShowToast] = useState(false);

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
      const response = await fetch("/api/admin/manual-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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

  return (
    <div className="space-y-5">
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
    </div>
  );
}
