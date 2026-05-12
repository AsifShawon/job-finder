"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Download, Loader2, PenLine, Sparkles, Upload, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TranslateButton } from "@/components/translate-button";

interface PrefillResponse {
  title: string | null;
  title_bn: string | null;
  summary_en: string | null;
  summary_bn: string | null;
  raw_description: string | null;
  country: string | null;
  employer: string | null;
  deadline: string | null;
  opportunity_type: string | null;
  sector: string | null;
  degree_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  application_url: string | null;
  eligibility_text: string | null;
  eligibility_text_bn: string | null;
  application_process: string | null;
  application_process_bn: string | null;
  visa_support: boolean | null;
  can_apply_from_bd: boolean | null;
  requirements: string[];
  benefits: string[];
  language_requirements: string[];
  journey_steps: string[];
  journey_steps_bn: string[];
  documents_needed: string[];
  documents_needed_bn: string[];
  typical_salary_bdt: number | null;
  extraction_confidence: number;
  fetched_url: string;
  warnings: string[];
}

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
  eligibility_text_bn: string;
  application_process: string;
  application_process_bn: string;
  visa_support: string;
  can_apply_from_bd: string;
  requirements: string;
  benefits: string;
  language_requirements: string;
  journey_steps: string;
  journey_steps_bn: string;
  documents_needed: string;
  documents_needed_bn: string;
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
  eligibility_text_bn: "",
  application_process: "",
  application_process_bn: "",
  visa_support: "",
  can_apply_from_bd: "",
  requirements: "",
  benefits: "",
  language_requirements: "",
  journey_steps: "",
  journey_steps_bn: "",
  documents_needed: "",
  documents_needed_bn: "",
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
  "eligibility_text_bn",
  "application_process",
  "application_process_bn",
  "visa_support",
  "can_apply_from_bd",
  "requirements",
  "benefits",
  "language_requirements",
  "journey_steps",
  "journey_steps_bn",
  "documents_needed",
  "documents_needed_bn",
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

const LABELS = {
  bn: {
    toggle: "বাংলা",
    toggleOther: "English",
    intake: "ম্যানুয়াল ইনটেক",
    notice: "এটি admin-only intake। একক এন্ট্রি এবং bulk upload দুটিই pending draft তৈরি করবে, যা review queue থেকে approve করতে হবে।",
    autosaveRestored: "আপনার আগের draft ব্রাউজার থেকে ফিরিয়ে আনা হয়েছে।",
    discard: "বাতিল করে নতুন শুরু করুন",
    prefillTitle: "URL পেস্ট করে ফর্ম পূরণ করুন",
    prefillDesc: "পেজটি AI দিয়ে পড়ে ফর্ম স্বয়ংক্রিয়ভাবে পূরণ হবে। আপনি আগে যা টাইপ করেছেন তা মুছবে না।",
    fetching: "আনা হচ্ছে...",
    autoFill: "অটো-ফিল",
    orUpload: "অথবা পোস্টার / PDF আপলোড করুন:",
    chooseFile: "ফাইল নির্বাচন করুন",
    confidence: "এক্সট্রাকশন কনফিডেন্স: ",
    jobTitle: "জব টাইটেল *",
    country: "দেশ",
    sourceUrl: "সোর্স URL *",
    employer: "নিয়োগকর্তা / প্রতিষ্ঠান",
    sourceName: "সোর্স নাম",
    deadline: "ডেডলাইন",
    opportunityType: "অপর্চুনিটি টাইপ",
    overseas: "প্রবাস চাকরি",
    local: "স্থানীয় চাকরি",
    training: "প্রশিক্ষণ",
    scholarship: "স্কলারশিপ",
    runAi: "AI Extraction চালু রাখুন",
    rawDesc: "র' জব ডেসক্রিপশন *",
    rawDescPlaceholder: "পূর্ণ চাকরির বিবরণ এখানে পেস্ট করুন, যে কোনো ভাষায়।",
    optionalFields: "ঐচ্ছিক Structured Fields",
    optionalFieldsDesc: "এগুলো সাধারণত AI পূরণ করে। AI extraction বন্ধ থাকলে, বা নিজে অতিরিক্ত structured তথ্য দিতে চাইলে এগুলো ব্যবহার করুন।",
    banglaTitle: "বাংলা শিরোনাম",
    sector: "সেক্টর",
    summaryEn: "ইংরেজি সারসংক্ষেপ",
    summaryBn: "বাংলা সারসংক্ষেপ",
    degreeLevel: "শিক্ষাগত স্তর",
    applicationUrl: "আবেদনের URL",
    salaryMin: "সর্বনিম্ন বেতন",
    salaryMax: "সর্বোচ্চ বেতন",
    salaryCurrency: "বেতনের মুদ্রা",
    typicalSalaryBdt: "আনুমানিক বেতন (BDT)",
    eligibilityEn: "যোগ্যতার বিবরণ (EN)",
    eligibilityBn: "যোগ্যতার বিবরণ (BN)",
    applicationProcessEn: "আবেদন প্রক্রিয়া (EN)",
    applicationProcessBn: "আবেদন প্রক্রিয়া (BN)",
    visaSupport: "ভিসা সহায়তা",
    canApplyFromBd: "বাংলাদেশ থেকে আবেদন করা যাবে",
    systemDecide: "সিস্টেম ঠিক করুক",
    yes: "হ্যাঁ",
    no: "না",
    requirements: "শর্তাবলি",
    benefits: "সুবিধাসমূহ",
    languageReq: "ভাষাগত শর্ত",
    journeyStepsEn: "আবেদনের ধাপ (EN)",
    journeyStepsBn: "আবেদনের ধাপ (BN)",
    documentsNeededEn: "প্রয়োজনীয় কাগজপত্র (EN)",
    documentsNeededBn: "প্রয়োজনীয় কাগজপত্র (BN)",
    onePerLine: "প্রতি লাইনে একটি আইটেম",
    oneStepPerLine: "প্রতি লাইনে একটি ধাপ",
    oneDocPerLine: "প্রতি লাইনে একটি কাগজপত্র",
    submit: "রিভিউ কিউতে যোগ করুন",
    submitting: "ড্রাফট তৈরি হচ্ছে...",
    goToReview: "রিভিউ কিউতে যান",
    addAnother: "আরেকটি যোগ করুন",
    draftCreated: (id: number) => `ড্রাফট #${id} তৈরি হয়েছে — অনুমোদনের জন্য রিভিউ কিউতে যান`,
    openReviewQueue: "রিভিউ কিউ খুলুন",
    dismiss: "বন্ধ করুন",
    dupExists: (status: string) => `এই URL-এর জন্য একটি draft আগে থেকেই আছে (স্ট্যাটাস: ${status})`,
    openDraft: (id: number) => `Draft #${id} খুলুন`,
    couldNotCreate: "ড্রাফট তৈরি করা যায়নি।",
    couldNotFetch: "URL থেকে তথ্য আনা যায়নি।",
    couldNotExtract: "ফাইল থেকে তথ্য আনা যায়নি।",
    pasteUrlFirst: "প্রথমে একটি URL দিন।",
    bulkImport: "বাল্ক ড্রাফট ইমপোর্ট",
    uploadCsv: "CSV বা Excel আপলোড করুন",
    bulkDesc: "একটি spreadsheet আপলোড করে এক ধাপে অনেক manual-entry draft তৈরি বা আপডেট করুন।",
    changeFile: "ফাইল পরিবর্তন করুন",
    noFileSelected: "এখনও কোনো ফাইল নির্বাচন করা হয়নি।",
    bulkRunAi: "সব row-এর জন্য AI Extraction চালু রাখুন",
    uploadToQueue: "রিভিউ কিউতে আপলোড করুন",
    importing: "ইমপোর্ট হচ্ছে...",
    downloadTemplate: "টেমপ্লেট ডাউনলোড করুন",
    couldNotImport: "ফাইল ইমপোর্ট করা যায়নি।",
    bulkSuccess: (c: number, u: number, s: number) => `তৈরি হয়েছে ${c}, আপডেট হয়েছে ${u}, বাদ গেছে ${s}।`,
    draftIdsReturned: (n: number) => `${n}টি draft ID পাওয়া গেছে।`,
    rowsWithIssues: "যে row-গুলোতে সমস্যা আছে",
    sheetGuide: "শিট গাইড",
    requiredOptionalCols: "প্রয়োজনীয় ও ঐচ্ছিক কলাম",
    sheetGuideDesc: "নিচের header নামগুলো হুবহু ব্যবহার করুন। AI extraction চালু থাকলে তা পুরো আপলোড করা ফাইলে প্রযোজ্য হবে।",
    required: "প্রয়োজনীয়",
    optional: "ঐচ্ছিক",
    listFieldFormat: "লিস্ট ফিল্ডের ফরম্যাট",
    listFieldDesc: "requirements, benefits, language_requirements, journey_steps এবং documents_needed ফিল্ডে প্রতি cell-এ এক লাইনে একটি item দিন। comma-separated fallback-ও কাজ করবে।",
  },
  en: {
    toggle: "English",
    toggleOther: "বাংলা",
    intake: "Editorial Intake",
    notice: "Admin-only intake. Single entries and bulk uploads both create pending drafts that must be approved from the review queue.",
    autosaveRestored: "Restored your unsaved draft from this browser.",
    discard: "Discard and start fresh",
    prefillTitle: "Paste a job URL to auto-fill",
    prefillDesc: "We'll fetch the page, run AI extraction, and pre-fill the form. Existing typed values are kept.",
    fetching: "Fetching...",
    autoFill: "Auto-fill",
    orUpload: "Or upload a poster / PDF:",
    chooseFile: "Choose file",
    confidence: "Extraction confidence: ",
    jobTitle: "Job Title *",
    country: "Country",
    sourceUrl: "Source URL *",
    employer: "Employer / Organization",
    sourceName: "Source Name",
    deadline: "Deadline",
    opportunityType: "Opportunity Type",
    overseas: "Overseas Job",
    local: "Local Job",
    training: "Training",
    scholarship: "Scholarship",
    runAi: "Run AI Extraction",
    rawDesc: "Raw Job Description *",
    rawDescPlaceholder: "Paste the full job posting text here, in any language.",
    optionalFields: "Optional Structured Fields",
    optionalFieldsDesc: "These are usually filled by AI. Use them when AI extraction is off, or when you want to supply missing structured details manually.",
    banglaTitle: "Bangla Title",
    sector: "Sector",
    summaryEn: "English Summary",
    summaryBn: "Bangla Summary",
    degreeLevel: "Degree Level",
    applicationUrl: "Application URL",
    salaryMin: "Salary Min",
    salaryMax: "Salary Max",
    salaryCurrency: "Salary Currency",
    typicalSalaryBdt: "Typical Salary in BDT",
    eligibilityEn: "Eligibility Text (EN)",
    eligibilityBn: "Eligibility Text (BN)",
    applicationProcessEn: "Application Process (EN)",
    applicationProcessBn: "Application Process (BN)",
    visaSupport: "Visa Support",
    canApplyFromBd: "Can Apply from Bangladesh",
    systemDecide: "Let system decide",
    yes: "Yes",
    no: "No",
    requirements: "Requirements",
    benefits: "Benefits",
    languageReq: "Language Requirements",
    journeyStepsEn: "Journey Steps (EN)",
    journeyStepsBn: "Journey Steps (BN)",
    documentsNeededEn: "Documents Needed (EN)",
    documentsNeededBn: "Documents Needed (BN)",
    onePerLine: "One item per line",
    oneStepPerLine: "One step per line",
    oneDocPerLine: "One document per line",
    submit: "Add to Review Queue",
    submitting: "Creating Draft...",
    goToReview: "Go to Review Queue",
    addAnother: "Add Another",
    draftCreated: (id: number) => `Draft #${id} created — go to Review Queue to approve`,
    openReviewQueue: "Open Review Queue",
    dismiss: "Dismiss",
    dupExists: (status: string) => `A draft with this URL already exists (status: ${status})`,
    openDraft: (id: number) => `Open draft #${id}`,
    couldNotCreate: "Could not create draft.",
    couldNotFetch: "Could not fetch the URL.",
    couldNotExtract: "Could not extract from file.",
    pasteUrlFirst: "Paste a URL first.",
    bulkImport: "Bulk Draft Import",
    uploadCsv: "Upload CSV or Excel",
    bulkDesc: "Upload one spreadsheet and create or update many manual-entry drafts in a single step.",
    changeFile: "Change file",
    noFileSelected: "No file selected yet.",
    bulkRunAi: "Run AI Extraction for all rows",
    uploadToQueue: "Upload to Review Queue",
    importing: "Importing...",
    downloadTemplate: "Download template",
    couldNotImport: "Could not import the file.",
    bulkSuccess: (c: number, u: number, s: number) => `Created ${c}, updated ${u}, skipped ${s}.`,
    draftIdsReturned: (n: number) => `${n} draft IDs returned.`,
    rowsWithIssues: "Rows with issues",
    sheetGuide: "Sheet Guide",
    requiredOptionalCols: "Required and Optional Columns",
    sheetGuideDesc: "Use the exact header names below. AI extraction, when enabled, applies to the whole uploaded file.",
    required: "Required",
    optional: "Optional",
    listFieldFormat: "List field format",
    listFieldDesc: "For requirements, benefits, language_requirements, journey_steps, and documents_needed, put one item per line inside a cell. Comma-separated fallback is also accepted.",
  },
} as const;

export function AdminManualEntryForm() {
  const [formLang, setFormLang] = useState<"bn" | "en">("bn");
  const L = LABELS[formLang];
  const isEn = formLang === "en";

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

  // Prefill (paste URL → AI auto-fill)
  const [prefillUrl, setPrefillUrl] = useState("");
  const [prefillBusy, setPrefillBusy] = useState(false);
  const [prefillError, setPrefillError] = useState("");
  const [prefillNotice, setPrefillNotice] = useState<string[]>([]);
  const [prefillConfidence, setPrefillConfidence] = useState<number | null>(null);

  // Auto-save + duplicate URL warning
  type DupHit = { found: true; draft_id: number; status: string; title: string | null };
  const [duplicate, setDuplicate] = useState<DupHit | null>(null);
  const [autosaveRestored, setAutosaveRestored] = useState(false);
  const AUTOSAVE_KEY = "manual-entry-draft";

  // Restore from localStorage on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as FormState;
      // Only restore if there's something meaningful saved.
      if (saved && (saved.title?.trim() || saved.source_url?.trim() || saved.raw_description?.trim())) {
        setForm({ ...DEFAULT_FORM, ...saved });
        setAutosaveRestored(true);
      }
    } catch {
      // ignore — corrupted localStorage shouldn't break the form
    }
  }, []);

  // Debounced auto-save: 600ms after the user stops typing.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        // Don't store the AI-extraction toggle; reset it each session.
        const { run_ai_extraction: _ignore, ...rest } = form;
        const hasContent = rest.title?.trim() || rest.source_url?.trim() || rest.raw_description?.trim();
        if (hasContent) {
          window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(rest));
        } else {
          window.localStorage.removeItem(AUTOSAVE_KEY);
        }
      } catch {
        // localStorage may be unavailable (private mode, quota exceeded) — silently skip.
      }
    }, 600);
    return () => window.clearTimeout(handle);
  }, [form]);

  // Duplicate URL check on source_url blur (debounced — only fires when the URL settles).
  useEffect(() => {
    const url = form.source_url.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      setDuplicate(null);
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/check-duplicate?url=${encodeURIComponent(url)}`);
        if (!response.ok) return;
        const payload = (await response.json()) as { found: boolean; draft_id?: number; status?: string; title?: string };
        if (payload.found && payload.draft_id) {
          setDuplicate({
            found: true,
            draft_id: payload.draft_id,
            status: payload.status ?? "pending",
            title: payload.title ?? null,
          });
        } else {
          setDuplicate(null);
        }
      } catch {
        setDuplicate(null);
      }
    }, 500);
    return () => window.clearTimeout(handle);
  }, [form.source_url]);

  const clearAutosave = () => {
    try {
      window.localStorage.removeItem(AUTOSAVE_KEY);
    } catch {
      // ignore
    }
    setAutosaveRestored(false);
  };

  const applyPrefillPayload = (payload: PrefillResponse) => {
    setForm((current) => {
      const keepIfTyped = <T extends string>(typed: T, suggested: T | null | undefined): T =>
        (typed && typed.trim() ? typed : (suggested ?? "")) as T;
      const numToStr = (n: number | null | undefined): string =>
        n == null ? "" : String(n);
      const boolToStr = (b: boolean | null | undefined): string =>
        b === true ? "true" : b === false ? "false" : "";
      const joinList = (existing: string, items: string[]): string =>
        existing && existing.trim() ? existing : items.join("\n");

      return {
        ...current,
        source_url: payload.fetched_url.startsWith("upload://") ? current.source_url : payload.fetched_url,
        title: keepIfTyped(current.title, payload.title),
        title_bn: keepIfTyped(current.title_bn, payload.title_bn),
        summary_en: keepIfTyped(current.summary_en, payload.summary_en),
        summary_bn: keepIfTyped(current.summary_bn, payload.summary_bn),
        raw_description: keepIfTyped(current.raw_description, payload.raw_description),
        country: keepIfTyped(current.country, payload.country),
        employer: keepIfTyped(current.employer, payload.employer),
        deadline: keepIfTyped(current.deadline, payload.deadline),
        opportunity_type: payload.opportunity_type ?? current.opportunity_type,
        sector: keepIfTyped(current.sector, payload.sector),
        degree_level: keepIfTyped(current.degree_level, payload.degree_level),
        salary_min: keepIfTyped(current.salary_min, numToStr(payload.salary_min)),
        salary_max: keepIfTyped(current.salary_max, numToStr(payload.salary_max)),
        salary_currency: keepIfTyped(current.salary_currency, payload.salary_currency),
        application_url: keepIfTyped(current.application_url, payload.application_url),
        eligibility_text: keepIfTyped(current.eligibility_text, payload.eligibility_text),
        eligibility_text_bn: keepIfTyped(current.eligibility_text_bn, payload.eligibility_text_bn),
        application_process: keepIfTyped(current.application_process, payload.application_process),
        application_process_bn: keepIfTyped(current.application_process_bn, payload.application_process_bn),
        visa_support: keepIfTyped(current.visa_support, boolToStr(payload.visa_support)),
        can_apply_from_bd: keepIfTyped(current.can_apply_from_bd, boolToStr(payload.can_apply_from_bd)),
        requirements: joinList(current.requirements, payload.requirements),
        benefits: joinList(current.benefits, payload.benefits),
        language_requirements: joinList(current.language_requirements, payload.language_requirements),
        journey_steps: joinList(current.journey_steps, payload.journey_steps),
        journey_steps_bn: joinList(current.journey_steps_bn, payload.journey_steps_bn),
        documents_needed: joinList(current.documents_needed, payload.documents_needed),
        documents_needed_bn: joinList(current.documents_needed_bn, payload.documents_needed_bn),
        typical_salary_bdt: keepIfTyped(current.typical_salary_bdt, numToStr(payload.typical_salary_bdt)),
      };
    });
    setPrefillConfidence(payload.extraction_confidence);
    setPrefillNotice(payload.warnings ?? []);
  };

  const runFileExtract = async (file: File) => {
    setPrefillBusy(true);
    setPrefillError("");
    setPrefillNotice([]);
    setPrefillConfidence(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/manual-entry/extract-from-file", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as PrefillResponse & { detail?: string };
      if (!response.ok) {
        setPrefillError(payload.detail || L.couldNotExtract);
        return;
      }
      applyPrefillPayload(payload);
    } finally {
      setPrefillBusy(false);
    }
  };

  const runPrefill = async () => {
    const url = prefillUrl.trim();
    if (!url) {
      setPrefillError(L.pasteUrlFirst);
      return;
    }
    setPrefillBusy(true);
    setPrefillError("");
    setPrefillNotice([]);
    setPrefillConfidence(null);
    try {
      const response = await fetch("/api/admin/manual-entry/prefill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json().catch(() => ({}))) as PrefillResponse & { detail?: string };
      if (!response.ok) {
        setPrefillError(payload.detail || L.couldNotFetch);
        return;
      }
      applyPrefillPayload(payload);
    } finally {
      setPrefillBusy(false);
    }
  };

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
        eligibility_text_bn: optionalText(form.eligibility_text_bn),
        application_process: optionalText(form.application_process),
        application_process_bn: optionalText(form.application_process_bn),
        visa_support: optionalBoolean(form.visa_support),
        can_apply_from_bd: optionalBoolean(form.can_apply_from_bd),
        requirements: optionalList(form.requirements),
        benefits: optionalList(form.benefits),
        language_requirements: optionalList(form.language_requirements),
        journey_steps: optionalList(form.journey_steps),
        journey_steps_bn: optionalList(form.journey_steps_bn),
        documents_needed: optionalList(form.documents_needed),
        documents_needed_bn: optionalList(form.documents_needed_bn),
        typical_salary_bdt: optionalInteger(form.typical_salary_bdt),
      };
      const response = await fetch("/api/admin/manual-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as ManualEntryResponse & { detail?: string };
      if (!response.ok) {
        setError(payload.detail || L.couldNotCreate);
        return;
      }
      setCreatedId(payload.id);
      setShowToast(true);
      setForm(DEFAULT_FORM);
      clearAutosave();
      setDuplicate(null);
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
        setBulkError(payload.detail || L.couldNotImport);
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

  const textareaClass = "min-h-[120px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-ring";
  const listTextareaClass = "min-h-[140px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-6">
      {showToast && createdId && (
        <div className="fixed right-4 top-4 z-50 max-w-sm rounded-2xl border border-emerald-200 bg-white p-4 shadow-xl dark:border-emerald-700/30 dark:bg-slate-950">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            {L.draftCreated(createdId)}
          </p>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <Link href="/admin/review" className="font-semibold text-primary hover:underline">
              {L.openReviewQueue}
            </Link>
            <button
              type="button"
              onClick={() => setShowToast(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              {L.dismiss}
            </button>
          </div>
        </div>
      )}

      <Card className="p-5">
        {/* Form-level BN | EN toggle */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{L.notice}</p>
          <div className="flex shrink-0 overflow-hidden rounded-lg border border-border text-sm font-semibold">
            <button
              type="button"
              onClick={() => setFormLang("bn")}
              className={`px-3 py-1.5 transition-colors ${formLang === "bn" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              বাংলা
            </button>
            <button
              type="button"
              onClick={() => setFormLang("en")}
              className={`px-3 py-1.5 transition-colors ${formLang === "en" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              English
            </button>
          </div>
        </div>

        {autosaveRestored && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-700/30 dark:bg-amber-900/10 dark:text-amber-300">
            <span>{L.autosaveRestored}</span>
            <button
              type="button"
              onClick={() => {
                setForm(DEFAULT_FORM);
                clearAutosave();
              }}
              className="font-semibold underline-offset-4 hover:underline"
            >
              {L.discard}
            </button>
          </div>
        )}

        {duplicate && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-300">
            <p className="font-semibold">{L.dupExists(duplicate.status)}</p>
            {duplicate.title && (
              <p className="mt-1 text-xs opacity-80">"{duplicate.title}"</p>
            )}
            <Link
              href={`/admin/review?focus=${duplicate.draft_id}`}
              className="mt-2 inline-block font-semibold underline-offset-4 hover:underline"
            >
              {L.openDraft(duplicate.draft_id)}
            </Link>
          </div>
        )}

        <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">{L.prefillTitle}</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{L.prefillDesc}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              type="url"
              value={prefillUrl}
              onChange={(event) => setPrefillUrl(event.target.value)}
              placeholder="https://..."
              className="min-w-0 flex-1"
              disabled={prefillBusy}
            />
            <Button type="button" onClick={runPrefill} disabled={prefillBusy || !prefillUrl.trim()}>
              {prefillBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              {prefillBusy ? L.fetching : L.autoFill}
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-primary/20 pt-3">
            <span className="text-xs text-muted-foreground">{L.orUpload}</span>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary">
              <Upload className="h-3.5 w-3.5" />
              {L.chooseFile}
              <input
                type="file"
                accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                disabled={prefillBusy}
                onChange={(event) => {
                  const f = event.target.files?.[0];
                  if (f) runFileExtract(f);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          {prefillError && (
            <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">{prefillError}</p>
          )}
          {prefillConfidence != null && (
            <p className="mt-3 text-xs text-muted-foreground">
              {L.confidence}
              <span className="font-semibold text-foreground">
                {Math.round(prefillConfidence * 100)}%
              </span>
            </p>
          )}
          {prefillNotice.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-300">
              {prefillNotice.map((line, i) => (
                <li key={i}>⚠ {line}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">{L.jobTitle}</span>
            <Input value={form.title} onChange={(event) => setField("title", event.target.value)} />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">{L.country}</span>
            <Input value={form.country} onChange={(event) => setField("country", event.target.value)} />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">{L.sourceUrl}</span>
            <Input value={form.source_url} onChange={(event) => setField("source_url", event.target.value)} />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">{L.employer}</span>
            <Input value={form.employer} onChange={(event) => setField("employer", event.target.value)} />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">{L.sourceName}</span>
            <Input value={form.source_name} onChange={(event) => setField("source_name", event.target.value)} />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">{L.deadline}</span>
            <Input type="date" value={form.deadline} onChange={(event) => setField("deadline", event.target.value)} />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-foreground">{L.opportunityType}</span>
            <select
              value={form.opportunity_type}
              onChange={(event) => setField("opportunity_type", event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="overseas_job">{L.overseas}</option>
              <option value="local_job">{L.local}</option>
              <option value="training">{L.training}</option>
              <option value="scholarship">{L.scholarship}</option>
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
              {L.runAi}
            </span>
          </label>
        </div>

        <label className="mt-5 block space-y-1.5">
          <span className="text-sm font-semibold text-foreground">{L.rawDesc}</span>
          <textarea
            value={form.raw_description}
            onChange={(event) => setField("raw_description", event.target.value)}
            placeholder={L.rawDescPlaceholder}
            className="min-h-[280px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <details
          open={!form.run_ai_extraction}
          className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/30"
        >
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            {L.optionalFields}
          </summary>
          <p className="mt-2 text-sm text-muted-foreground">{L.optionalFieldsDesc}</p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Title BN */}
            <label className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{L.banglaTitle}</span>
                <TranslateButton
                  sourceText={form.title}
                  sourceLang="en"
                  targetLang="bn"
                  fieldName="title"
                  onTranslated={(text) => setField("title_bn", text)}
                  isEn={isEn}
                />
              </div>
              <Input value={form.title_bn} onChange={(event) => setField("title_bn", event.target.value)} />
            </label>

            {/* Sector */}
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{L.sector}</span>
              <Input value={form.sector} onChange={(event) => setField("sector", event.target.value)} />
            </label>

            {/* Summary EN */}
            <label className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{L.summaryEn}</span>
                <TranslateButton
                  sourceText={form.summary_bn}
                  sourceLang="bn"
                  targetLang="en"
                  fieldName="summary"
                  onTranslated={(text) => setField("summary_en", text)}
                  isEn={isEn}
                />
              </div>
              <textarea
                value={form.summary_en}
                onChange={(event) => setField("summary_en", event.target.value)}
                className={textareaClass}
              />
            </label>

            {/* Summary BN */}
            <label className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{L.summaryBn}</span>
                <TranslateButton
                  sourceText={form.summary_en}
                  sourceLang="en"
                  targetLang="bn"
                  fieldName="summary"
                  onTranslated={(text) => setField("summary_bn", text)}
                  isEn={isEn}
                />
              </div>
              <textarea
                value={form.summary_bn}
                onChange={(event) => setField("summary_bn", event.target.value)}
                className={textareaClass}
              />
            </label>

            {/* Degree Level */}
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{L.degreeLevel}</span>
              <Input value={form.degree_level} onChange={(event) => setField("degree_level", event.target.value)} />
            </label>

            {/* Application URL */}
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{L.applicationUrl}</span>
              <Input value={form.application_url} onChange={(event) => setField("application_url", event.target.value)} />
            </label>

            {/* Salary Min */}
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{L.salaryMin}</span>
              <Input type="number" min="0" value={form.salary_min} onChange={(event) => setField("salary_min", event.target.value)} />
            </label>

            {/* Salary Max */}
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{L.salaryMax}</span>
              <Input type="number" min="0" value={form.salary_max} onChange={(event) => setField("salary_max", event.target.value)} />
            </label>

            {/* Salary Currency */}
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{L.salaryCurrency}</span>
              <Input placeholder="SAR / AED / USD / BDT" value={form.salary_currency} onChange={(event) => setField("salary_currency", event.target.value)} />
            </label>

            {/* Typical Salary BDT */}
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{L.typicalSalaryBdt}</span>
              <Input type="number" min="0" value={form.typical_salary_bdt} onChange={(event) => setField("typical_salary_bdt", event.target.value)} />
            </label>

            {/* Eligibility EN */}
            <label className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{L.eligibilityEn}</span>
                <TranslateButton
                  sourceText={form.eligibility_text_bn}
                  sourceLang="bn"
                  targetLang="en"
                  fieldName="eligibility_text"
                  onTranslated={(text) => setField("eligibility_text", text)}
                  isEn={isEn}
                />
              </div>
              <textarea
                value={form.eligibility_text}
                onChange={(event) => setField("eligibility_text", event.target.value)}
                className={textareaClass}
              />
            </label>

            {/* Eligibility BN */}
            <label className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{L.eligibilityBn}</span>
                <TranslateButton
                  sourceText={form.eligibility_text}
                  sourceLang="en"
                  targetLang="bn"
                  fieldName="eligibility_text"
                  onTranslated={(text) => setField("eligibility_text_bn", text)}
                  isEn={isEn}
                />
              </div>
              <textarea
                value={form.eligibility_text_bn}
                onChange={(event) => setField("eligibility_text_bn", event.target.value)}
                className={textareaClass}
              />
            </label>

            {/* Application Process EN */}
            <label className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{L.applicationProcessEn}</span>
                <TranslateButton
                  sourceText={form.application_process_bn}
                  sourceLang="bn"
                  targetLang="en"
                  fieldName="application_process"
                  onTranslated={(text) => setField("application_process", text)}
                  isEn={isEn}
                />
              </div>
              <textarea
                value={form.application_process}
                onChange={(event) => setField("application_process", event.target.value)}
                className={textareaClass}
              />
            </label>

            {/* Application Process BN */}
            <label className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{L.applicationProcessBn}</span>
                <TranslateButton
                  sourceText={form.application_process}
                  sourceLang="en"
                  targetLang="bn"
                  fieldName="application_process"
                  onTranslated={(text) => setField("application_process_bn", text)}
                  isEn={isEn}
                />
              </div>
              <textarea
                value={form.application_process_bn}
                onChange={(event) => setField("application_process_bn", event.target.value)}
                className={textareaClass}
              />
            </label>

            {/* Visa Support */}
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{L.visaSupport}</span>
              <select
                value={form.visa_support}
                onChange={(event) => setField("visa_support", event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{L.systemDecide}</option>
                <option value="true">{L.yes}</option>
                <option value="false">{L.no}</option>
              </select>
            </label>

            {/* Can Apply from BD */}
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{L.canApplyFromBd}</span>
              <select
                value={form.can_apply_from_bd}
                onChange={(event) => setField("can_apply_from_bd", event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{L.systemDecide}</option>
                <option value="true">{L.yes}</option>
                <option value="false">{L.no}</option>
              </select>
            </label>

            {/* Requirements (no bn variant in DB) */}
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{L.requirements}</span>
              <textarea
                value={form.requirements}
                onChange={(event) => setField("requirements", event.target.value)}
                placeholder={L.onePerLine}
                className={listTextareaClass}
              />
            </label>

            {/* Benefits (no bn variant in DB) */}
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-foreground">{L.benefits}</span>
              <textarea
                value={form.benefits}
                onChange={(event) => setField("benefits", event.target.value)}
                placeholder={L.onePerLine}
                className={listTextareaClass}
              />
            </label>

            {/* Language Requirements (no bn variant in DB) */}
            <label className="space-y-1.5 md:col-span-2">
              <span className="text-sm font-semibold text-foreground">{L.languageReq}</span>
              <textarea
                value={form.language_requirements}
                onChange={(event) => setField("language_requirements", event.target.value)}
                placeholder={L.onePerLine}
                className={listTextareaClass}
              />
            </label>

            {/* Journey Steps EN */}
            <label className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{L.journeyStepsEn}</span>
                <TranslateButton
                  sourceText={form.journey_steps_bn}
                  sourceLang="bn"
                  targetLang="en"
                  fieldName="journey_steps"
                  onTranslated={(text) => setField("journey_steps", text)}
                  isEn={isEn}
                />
              </div>
              <textarea
                value={form.journey_steps}
                onChange={(event) => setField("journey_steps", event.target.value)}
                placeholder={L.oneStepPerLine}
                className={listTextareaClass}
              />
            </label>

            {/* Journey Steps BN */}
            <label className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{L.journeyStepsBn}</span>
                <TranslateButton
                  sourceText={form.journey_steps}
                  sourceLang="en"
                  targetLang="bn"
                  fieldName="journey_steps"
                  onTranslated={(text) => setField("journey_steps_bn", text)}
                  isEn={isEn}
                />
              </div>
              <textarea
                value={form.journey_steps_bn}
                onChange={(event) => setField("journey_steps_bn", event.target.value)}
                placeholder={L.oneStepPerLine}
                className={listTextareaClass}
              />
            </label>

            {/* Documents Needed EN */}
            <label className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{L.documentsNeededEn}</span>
                <TranslateButton
                  sourceText={form.documents_needed_bn}
                  sourceLang="bn"
                  targetLang="en"
                  fieldName="documents_needed"
                  onTranslated={(text) => setField("documents_needed", text)}
                  isEn={isEn}
                />
              </div>
              <textarea
                value={form.documents_needed}
                onChange={(event) => setField("documents_needed", event.target.value)}
                placeholder={L.oneDocPerLine}
                className={listTextareaClass}
              />
            </label>

            {/* Documents Needed BN */}
            <label className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{L.documentsNeededBn}</span>
                <TranslateButton
                  sourceText={form.documents_needed}
                  sourceLang="en"
                  targetLang="bn"
                  fieldName="documents_needed"
                  onTranslated={(text) => setField("documents_needed_bn", text)}
                  isEn={isEn}
                />
              </div>
              <textarea
                value={form.documents_needed_bn}
                onChange={(event) => setField("documents_needed_bn", event.target.value)}
                placeholder={L.oneDocPerLine}
                className={listTextareaClass}
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
            {busy ? L.submitting : L.submit}
          </Button>

          <Link href="/admin/review" className="text-sm font-semibold text-primary hover:underline">
            {L.goToReview}
          </Link>

          <button
            type="button"
            onClick={() => {
              setForm(DEFAULT_FORM);
              setError("");
              setShowToast(false);
              clearAutosave();
              setDuplicate(null);
            }}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {L.addAnother}
          </button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <Card className="p-5">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {L.bulkImport}
            </p>
            <h2 className="mt-1 text-xl font-bold text-foreground">{L.uploadCsv}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{L.bulkDesc}</p>
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
                {bulkFile ? L.changeFile : L.chooseFile}
              </Button>
              <span className="text-sm text-muted-foreground">
                {bulkFile?.name || L.noFileSelected}
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
                {L.bulkRunAi}
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={submitBulk} disabled={bulkBusy || !bulkFile}>
                {bulkBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {bulkBusy ? L.importing : L.uploadToQueue}
              </Button>
              <a
                href="/api/admin/manual-entry/template"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                <Download className="h-4 w-4" />
                {L.downloadTemplate}
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
                  {L.bulkSuccess(bulkResult.created, bulkResult.updated, bulkResult.skipped)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <Link href="/admin/review" className="font-semibold text-primary hover:underline">
                    {L.openReviewQueue}
                  </Link>
                  {bulkResult.draft_ids.length > 0 && (
                    <span className="text-muted-foreground">
                      {L.draftIdsReturned(bulkResult.draft_ids.length)}
                    </span>
                  )}
                </div>
                {bulkResult.errors.length > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-white/80 p-3 text-sm dark:bg-slate-950/30">
                    <p className="font-semibold text-amber-700 dark:text-amber-300">
                      {L.rowsWithIssues}
                    </p>
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      {bulkResult.errors.map((item) => (
                        <li key={`${item.row}-${item.detail}`}>
                          Row {item.row}: {item.detail}
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
              {L.sheetGuide}
            </p>
            <h2 className="mt-1 text-xl font-bold text-foreground">{L.requiredOptionalCols}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{L.sheetGuideDesc}</p>
          </div>

          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{L.required}</h3>
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
              <h3 className="text-sm font-semibold text-foreground">{L.optional}</h3>
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
              <p className="font-semibold text-foreground">{L.listFieldFormat}</p>
              <p className="mt-1">{L.listFieldDesc}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
