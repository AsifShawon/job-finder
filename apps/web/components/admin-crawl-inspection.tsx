"use client";

import { useEffect, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  CrawlInspectionPageSummary,
  CrawlRunInspection,
  RawDocumentActionResult,
  RawDocumentBatchActionResult,
  RawDocumentInspection,
  SaveAiEditsRequest,
} from "@/lib/types";

type TabKey = "overview" | "pages" | "parser" | "input" | "output" | "preview";
type BulkActionKey = "parse-sections" | "run-ai" | "use-fallback" | "publish" | "mark-review";

interface AdminCrawlInspectionProps {
  initialRun: CrawlRunInspection;
  locale: "bn" | "en";
}

interface ProgressItem {
  title: string;
  status: string;
}

interface BulkProgressState {
  open: boolean;
  title: string;
  total: number;
  processed: number;
  skipped: number;
  failed: number;
  currentJob: string | null;
  items: ProgressItem[];
}

interface ProcessAllOptions {
  runParser: boolean;
  runAi: boolean;
  useFallback: boolean;
  publish: boolean;
}

interface PublishOptions {
  publishReady: boolean;
  moveNeedsReview: boolean;
  skipFailed: boolean;
}

interface BulkActionAvailability {
  enabled: boolean;
  reason: string | null;
  ids: number[];
}

interface BulkActions {
  parse: BulkActionAvailability;
  runAi: BulkActionAvailability;
  fallback: BulkActionAvailability;
  publish: BulkActionAvailability;
  review: BulkActionAvailability;
  export: BulkActionAvailability;
}

interface EditorState {
  title: string;
  titleBn: string;
  summaryEn: string;
  summaryBn: string;
  country: string;
  city: string;
  employer: string;
  organization: string;
  applicationUrl: string;
  salaryText: string;
  deadlineText: string;
  eligibilityText: string;
  requirements: string;
  responsibilities: string;
  journeySteps: string;
  documentsNeeded: string;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }
  return response.json() as Promise<T>;
}

function pretty(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function joinLines(value: unknown): string {
  return asArray(value).join("\n");
}

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function uniqueIds(values: number[]): number[] {
  return Array.from(new Set(values));
}

const TEXT = {
  en: {
    note: "This page helps you review scraped jobs, structure them with AI, and publish them safely.",
    sourceCards: {
      crawlCompleted: "Crawl completed",
      jobsFound: "Jobs found",
      parsed: "Parsed",
      readyForAi: "Ready for AI",
      aiCompleted: "AI completed",
      readyToPublish: "Ready to publish",
      published: "Published",
      needsReview: "Needs review",
      failed: "Failed",
    },
    tabs: {
      overview: "Crawl Overview",
      pages: "Scraped Pages",
      parser: "Parsed Job Details",
      input: "What AI Brain Will Read",
      output: "AI Structured Result",
      preview: "Publish Preview",
    },
    filters: {
      all: "All",
      needs_parser: "Needs parser",
      ready_for_ai: "Ready for AI Brain",
      ai_completed: "AI completed",
      ready_to_publish: "Ready to publish",
      published: "Published",
      failed: "Failed",
      low_confidence: "Low confidence",
    },
    actions: {
      refresh: "Refresh",
      adminView: "Admin View",
      developerView: "Developer View",
      processAll: "Process all scraped jobs",
      parseSelected: "Parse selected",
      sendSelectedToAi: "Send selected to AI Brain",
      useFallback: "Use safe backup output",
      publishSelected: "Publish selected ready jobs",
      markReview: "Mark selected as needs manual review",
      exportReport: "Export selected report",
      selectAllVisible: "Select all visible rows",
      selectAllInRun: "Select all jobs in this crawl",
      clearSelection: "Clear selection",
      inspect: "Inspect",
      parse: "Parse",
      recheck: "Recheck job details",
      sendToAi: "Send to AI",
      preview: "Preview",
      publish: "Publish",
      review: "Review",
      openPage: "Open original page",
      viewPublicPage: "View public page",
      saveAiEdits: "Save edited result",
      acceptAiOutput: "Accept AI output",
      rerunAi: "Re-run AI",
      backToAi: "Back to AI output",
      savePendingReview: "Save as pending review",
      editFields: "Edit fields",
      showAdvanced: "Show advanced details",
      hideAdvanced: "Hide advanced details",
      showRawParserJson: "Show raw parser JSON",
      showCompactAiJson: "Show compact AI JSON",
      showRawAiResponse: "Show raw AI response",
    },
    labels: {
      selected: "jobs selected",
      stage: "Stage",
      confidence: "Confidence",
      keyInfo: "Key information found",
      recommendedAction: "Recommended action",
      lastResult: "Last result",
      actions: "Actions",
      search: "Search by title, company, country, city",
      currentJob: "Current job",
      processing: "Processing",
      previewing: "Previewing",
      of: "of",
      ready: "Ready to publish",
      problems: "Problems",
      yes: "Yes",
      no: "No",
      noSelection: "Select one or more jobs to run bulk actions.",
      parserWarnings: "Parser warnings",
      noiseRemoved: "Noise removed",
      missingFields: "Missing fields",
      warnings: "Warnings",
      advancedDetails: "Advanced details",
      developerNote: "Developer view keeps the current raw diagnostics and JSON editing flow.",
      noInspection: "Select a job to inspect.",
      noItems: "No jobs match the current filters.",
    },
    modal: {
      processAllTitle: "Process all scraped jobs?",
      runParser: "Run parser",
      runAi: "Run AI Brain after parser succeeds",
      useFallback: "Use fallback if AI fails",
      publish: "Publish only high confidence completed jobs",
      start: "Start processing",
      cancel: "Cancel",
      publishTitle: "Publish selected jobs?",
      publishReady: "Publish only ready jobs",
      moveNeedsReview: "Move needs review jobs to review queue",
      skipFailed: "Skip failed jobs",
      confirmPublish: "Confirm publish",
      readyCount: "Ready to publish",
      reviewCount: "Needs review",
      failedCount: "Failed",
    },
    keyInfo: {
      title: "Title",
      country: "Country",
      city: "City",
      requirements: "Requirements",
      responsibilities: "Responsibilities",
      apply_link: "Apply link",
      salary: "Salary",
      deadline: "Deadline",
    },
    stageLabels: {
      scraped: "Scraped",
      parsed: "Parsed",
      ai_structured: "AI Structured",
      ready_to_publish: "Ready to Publish",
      published: "Published",
      failed: "Failed",
    },
    statusLabels: {
      scraped: "Waiting",
      parser_pending_admin: "Parsed, waiting for approval",
      parser_low_confidence: "Needs parser review",
      ai_pending_admin: "Ready for AI Brain",
      ai_completed_pending_publish: "AI output ready",
      fallback_ready_pending_publish: "Fallback output ready",
      published: "Published",
      failed: "Failed",
      needs_review: "Needs review",
    },
  },
  bn: {
    note: "এই পেজে আপনি স্ক্র্যাপ করা চাকরিগুলো ধাপে ধাপে যাচাই, AI দিয়ে সাজানো, এবং পাবলিশ করতে পারবেন।",
    sourceCards: {
      crawlCompleted: "ক্রল শেষ",
      jobsFound: "চাকরি পাওয়া গেছে",
      parsed: "পার্সড",
      readyForAi: "AI এর জন্য প্রস্তুত",
      aiCompleted: "AI সম্পন্ন",
      readyToPublish: "পাবলিশের জন্য প্রস্তুত",
      published: "পাবলিশড",
      needsReview: "রিভিউ দরকার",
      failed: "সমস্যা হয়েছে",
    },
    tabs: {
      overview: "ক্রল ওভারভিউ",
      pages: "স্ক্র্যাপ করা পেজ",
      parser: "পার্স করা চাকরির তথ্য",
      input: "AI Brain কী পড়বে",
      output: "AI সাজানো ফলাফল",
      preview: "পাবলিশ প্রিভিউ",
    },
    filters: {
      all: "সব",
      needs_parser: "পার্স দরকার",
      ready_for_ai: "AI Brain এর জন্য প্রস্তুত",
      ai_completed: "AI সম্পন্ন",
      ready_to_publish: "পাবলিশের জন্য প্রস্তুত",
      published: "পাবলিশড",
      failed: "সমস্যা হয়েছে",
      low_confidence: "কম কনফিডেন্স",
    },
    actions: {
      refresh: "রিফ্রেশ",
      adminView: "অ্যাডমিন ভিউ",
      developerView: "ডেভেলপার ভিউ",
      processAll: "সব পাওয়া চাকরি প্রসেস করুন",
      parseSelected: "সিলেক্ট করা চাকরি পার্স করুন",
      sendSelectedToAi: "সিলেক্ট করা চাকরি AI Brain এ পাঠান",
      useFallback: "সেইফ ব্যাকআপ আউটপুট ব্যবহার করুন",
      publishSelected: "প্রস্তুত চাকরিগুলো পাবলিশ করুন",
      markReview: "সিলেক্ট করা চাকরি রিভিউতে পাঠান",
      exportReport: "সিলেক্ট করা রিপোর্ট এক্সপোর্ট করুন",
      selectAllVisible: "দেখানো সারিগুলো সিলেক্ট করুন",
      selectAllInRun: "এই ক্রলের সব চাকরি সিলেক্ট করুন",
      clearSelection: "সিলেকশন পরিষ্কার করুন",
      inspect: "দেখুন",
      parse: "পার্স করুন",
      recheck: "চাকরির তথ্য আবার দেখুন",
      sendToAi: "AI তে পাঠান",
      preview: "প্রিভিউ",
      publish: "পাবলিশ",
      review: "রিভিউ",
      openPage: "অরিজিনাল পেজ খুলুন",
      viewPublicPage: "পাবলিক পেজ দেখুন",
      saveAiEdits: "এডিট করা ফলাফল সেভ করুন",
      acceptAiOutput: "AI ফলাফল গ্রহণ করুন",
      rerunAi: "AI আবার চালান",
      backToAi: "AI আউটপুটে ফিরে যান",
      savePendingReview: "রিভিউ হিসেবে সেভ করুন",
      editFields: "ফিল্ড এডিট করুন",
      showAdvanced: "অ্যাডভান্সড তথ্য দেখুন",
      hideAdvanced: "অ্যাডভান্সড তথ্য লুকান",
      showRawParserJson: "র' পার্সার JSON দেখুন",
      showCompactAiJson: "কমপ্যাক্ট AI JSON দেখুন",
      showRawAiResponse: "র' AI রেসপন্স দেখুন",
    },
    labels: {
      selected: "টি চাকরি সিলেক্ট করা হয়েছে",
      stage: "ধাপ",
      confidence: "কনফিডেন্স",
      keyInfo: "কী তথ্য পাওয়া গেছে",
      recommendedAction: "পরের কাজ",
      lastResult: "সর্বশেষ ফলাফল",
      actions: "অ্যাকশন",
      search: "টাইটেল, কোম্পানি, দেশ, শহর দিয়ে খুঁজুন",
      currentJob: "বর্তমান চাকরি",
      processing: "প্রসেস হচ্ছে",
      previewing: "দেখানো হচ্ছে",
      of: "এর মধ্যে",
      ready: "পাবলিশের জন্য প্রস্তুত",
      problems: "সমস্যা",
      yes: "হ্যাঁ",
      no: "না",
      noSelection: "বাল্ক অ্যাকশন চালাতে এক বা একাধিক চাকরি সিলেক্ট করুন।",
      parserWarnings: "পার্সার সতর্কতা",
      noiseRemoved: "সরানো নোইজ",
      missingFields: "মিসিং ফিল্ড",
      warnings: "সতর্কতা",
      advancedDetails: "অ্যাডভান্সড তথ্য",
      developerNote: "ডেভেলপার ভিউতে বর্তমান র' ডায়াগনস্টিকস এবং JSON এডিটিং ফ্লো থাকবে।",
      noInspection: "দেখার জন্য একটি চাকরি বেছে নিন।",
      noItems: "এই ফিল্টারে কোনো চাকরি পাওয়া যায়নি।",
    },
    modal: {
      processAllTitle: "সব পাওয়া চাকরি প্রসেস করবেন?",
      runParser: "পার্সার চালান",
      runAi: "পার্সার সফল হলে AI Brain চালান",
      useFallback: "AI ব্যর্থ হলে ফallback ব্যবহার করুন",
      publish: "শুধু হাই কনফিডেন্স সম্পন্ন চাকরি পাবলিশ করুন",
      start: "প্রসেস শুরু করুন",
      cancel: "বাতিল",
      publishTitle: "সিলেক্ট করা চাকরি পাবলিশ করবেন?",
      publishReady: "শুধু প্রস্তুত চাকরি পাবলিশ করুন",
      moveNeedsReview: "রিভিউ দরকার এমন চাকরি রিভিউ কিউতে পাঠান",
      skipFailed: "ব্যর্থ চাকরি স্কিপ করুন",
      confirmPublish: "পাবলিশ নিশ্চিত করুন",
      readyCount: "পাবলিশের জন্য প্রস্তুত",
      reviewCount: "রিভিউ দরকার",
      failedCount: "সমস্যা হয়েছে",
    },
    keyInfo: {
      title: "টাইটেল",
      country: "দেশ",
      city: "শহর",
      requirements: "রিকোয়ারমেন্ট",
      responsibilities: "দায়িত্ব",
      apply_link: "আবেদন লিংক",
      salary: "বেতন",
      deadline: "ডেডলাইন",
    },
    stageLabels: {
      scraped: "স্ক্র্যাপ করা হয়েছে",
      parsed: "পার্সড",
      ai_structured: "AI সাজানো",
      ready_to_publish: "পাবলিশের জন্য প্রস্তুত",
      published: "পাবলিশড",
      failed: "সমস্যা হয়েছে",
    },
    statusLabels: {
      scraped: "অপেক্ষা করছে",
      parser_pending_admin: "পার্স হয়েছে, অনুমোদনের অপেক্ষায়",
      parser_low_confidence: "পার্সার রিভিউ দরকার",
      ai_pending_admin: "AI Brain এর জন্য প্রস্তুত",
      ai_completed_pending_publish: "AI ফলাফল প্রস্তুত",
      fallback_ready_pending_publish: "ব্যাকআপ ফলাফল প্রস্তুত",
      published: "পাবলিশড",
      failed: "সমস্যা হয়েছে",
      needs_review: "রিভিউ দরকার",
    },
  },
} as const;

function toneClass(tone: string) {
  switch (tone) {
    case "green":
      return "bg-green-50 text-green-700 border-green-200";
    case "yellow":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "blue":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "red":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function keyInfoClass(state: string) {
  switch (state) {
    case "found":
      return "bg-green-50 text-green-700 border-green-200";
    case "risky":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function stageFromPage(page: CrawlInspectionPageSummary): string {
  return page.stage || "scraped";
}

function isReadyForAi(page: CrawlInspectionPageSummary): boolean {
  return page.ai_status === "ai_pending_admin" || page.parser_status === "parser_pending_admin" || page.parser_status === "parser_low_confidence";
}

function isReadyToPublish(page: CrawlInspectionPageSummary): boolean {
  return stageFromPage(page) === "ready_to_publish" && page.publish_status !== "published";
}

function bulkAvailability(pages: CrawlInspectionPageSummary[], t: typeof TEXT.en | typeof TEXT.bn): BulkActions {
  const parseIds = pages.map((page) => page.raw_document_id);
  const runAiIds = pages.filter((page) => isReadyForAi(page)).map((page) => page.raw_document_id);
  const fallbackIds = pages
    .filter((page) => Boolean(page.parser_status) && page.ai_status !== "fallback_ready_pending_publish" && page.publish_status !== "published" && !page.failed_reason)
    .map((page) => page.raw_document_id);
  const publishIds = pages.filter(isReadyToPublish).map((page) => page.raw_document_id);
  const reviewIds = pages
    .filter((page) => Boolean(page.parser_status || page.ai_status) && page.publish_status !== "published" && !page.failed_reason)
    .map((page) => page.raw_document_id);
  const exportIds = pages.map((page) => page.raw_document_id);

  return {
    parse: { enabled: parseIds.length > 0, reason: parseIds.length > 0 ? null : t.labels.noSelection, ids: parseIds },
    runAi: {
      enabled: runAiIds.length > 0,
      reason: runAiIds.length > 0 ? null : "Run parser first.",
      ids: runAiIds,
    },
    fallback: {
      enabled: fallbackIds.length > 0,
      reason: fallbackIds.length > 0 ? null : "Parse jobs first.",
      ids: fallbackIds,
    },
    publish: {
      enabled: publishIds.length > 0,
      reason: publishIds.length > 0 ? null : "Only ready jobs can be published.",
      ids: publishIds,
    },
    review: {
      enabled: reviewIds.length > 0,
      reason: reviewIds.length > 0 ? null : "Parse jobs first.",
      ids: reviewIds,
    },
    export: {
      enabled: exportIds.length > 0,
      reason: exportIds.length > 0 ? null : t.labels.noSelection,
      ids: exportIds,
    },
  };
}

function validationProblems(payload: Record<string, unknown>, page: CrawlInspectionPageSummary | null): string[] {
  const problems: string[] = [];
  if (!toText(payload.salary_text) && payload.salary_min == null && payload.salary_max == null) {
    problems.push("Salary missing but acceptable");
  }
  if (!toText(payload.deadline_text)) {
    problems.push("Deadline missing but acceptable");
  }
  const eligibilityText = `${toText(payload.eligibility_text)} ${toText(payload.summary_en)} ${toText(payload.summary_bn)}`.toLowerCase();
  if (eligibilityText.includes("transferable iqama")) {
    problems.push("Transferable iqama found");
  }
  if (!toText(payload.eligibility_text) && page?.status_label !== "Published") {
    problems.push("Bangladesh apply status unclear");
  }
  return problems;
}

function createEditorState(inspection: RawDocumentInspection | null): EditorState {
  const payload = asRecord(inspection?.validated_ai_output);
  return {
    title: toText(payload.title),
    titleBn: toText(payload.title_bn),
    summaryEn: toText(payload.summary_en),
    summaryBn: toText(payload.summary_bn),
    country: toText(payload.country),
    city: toText(payload.city),
    employer: toText(payload.employer),
    organization: toText(payload.organization),
    applicationUrl: toText(payload.application_url),
    salaryText: toText(payload.salary_text),
    deadlineText: toText(payload.deadline_text),
    eligibilityText: toText(payload.eligibility_text),
    requirements: joinLines(payload.requirements),
    responsibilities: joinLines(payload.responsibilities),
    journeySteps: joinLines(payload.journey_steps),
    documentsNeeded: joinLines(payload.documents_needed),
  };
}

function selectedCountText(locale: "bn" | "en", count: number, t: typeof TEXT.en | typeof TEXT.bn) {
  return locale === "en" ? `${count} ${t.labels.selected}` : `${count}${t.labels.selected}`;
}

export function AdminCrawlInspection({ initialRun, locale }: AdminCrawlInspectionProps) {
  const isEn = locale === "en";
  const t = TEXT[locale];
  const [run, setRun] = useState(initialRun);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedRawId, setSelectedRawId] = useState<number | null>(initialRun.pages[0]?.raw_document_id ?? null);
  const [inspection, setInspection] = useState<RawDocumentInspection | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [parserJson, setParserJson] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [showDeveloperView, setShowDeveloperView] = useState(false);
  const [bulkActionRunning, setBulkActionRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgressState>({
    open: false,
    title: "",
    total: 0,
    processed: 0,
    skipped: 0,
    failed: 0,
    currentJob: null,
    items: [],
  });
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [showProcessAllModal, setShowProcessAllModal] = useState(false);
  const [processAllOptions, setProcessAllOptions] = useState<ProcessAllOptions>({
    runParser: true,
    runAi: true,
    useFallback: false,
    publish: false,
  });
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [publishOptions, setPublishOptions] = useState<PublishOptions>({
    publishReady: true,
    moveNeedsReview: true,
    skipFailed: true,
  });
  const [showRawParserJson, setShowRawParserJson] = useState(false);
  const [showCompactAiJson, setShowCompactAiJson] = useState(false);
  const [showRawAiResponse, setShowRawAiResponse] = useState(false);
  const [editingAi, setEditingAi] = useState(false);
  const [editorState, setEditorState] = useState<EditorState>(createEditorState(null));
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedRawId) return;
    startTransition(() => {
      fetchJson<RawDocumentInspection>(`/api/admin/raw-documents/${selectedRawId}/inspection`)
        .then((data) => {
          setInspection(data);
          setParserJson(pretty(asRecord(asRecord(data.section_parser).parsed_payload)));
        })
        .catch((error: Error) => setMessage(error.message));
    });
  }, [selectedRawId]);

  useEffect(() => {
    setEditorState(createEditorState(inspection));
  }, [inspection]);

  useEffect(() => {
    if (run.pages.length === 0) {
      setSelectedRawId(null);
      return;
    }
    if (!selectedRawId || !run.pages.some((page) => page.raw_document_id === selectedRawId)) {
      setSelectedRawId(run.pages[0].raw_document_id);
    }
  }, [run, selectedRawId]);

  const filteredPages = run.pages.filter((page) => {
    const matchesQuery =
      query.trim().length === 0 ||
      [page.title, page.company, page.country, page.city].some((value) =>
        toText(value).toLowerCase().includes(query.trim().toLowerCase()),
      );
    if (!matchesQuery) return false;
    switch (filter) {
      case "needs_parser":
        return stageFromPage(page) === "scraped";
      case "ready_for_ai":
        return page.ai_status === "ai_pending_admin";
      case "ai_completed":
        return page.ai_status === "ai_completed_pending_publish" || page.ai_status === "fallback_ready_pending_publish";
      case "ready_to_publish":
        return stageFromPage(page) === "ready_to_publish";
      case "published":
        return page.publish_status === "published";
      case "failed":
        return stageFromPage(page) === "failed";
      case "low_confidence":
        return page.parser_status === "parser_low_confidence";
      default:
        return true;
    }
  });

  const visibleIds = filteredPages.map((page) => page.raw_document_id);
  const selectedPages = run.pages.filter((page) => selectedIds.has(page.raw_document_id));
  const bulkActions = bulkAvailability(selectedPages, t);
  const currentPage = run.pages.find((page) => page.raw_document_id === selectedRawId) ?? null;
  const previewIds = selectedIds.size > 0 ? run.pages.filter((page) => selectedIds.has(page.raw_document_id)).map((page) => page.raw_document_id) : selectedRawId ? [selectedRawId] : [];

  useEffect(() => {
    if (previewIds.length === 0) {
      setSelectedPreviewIndex(0);
      return;
    }
    const nextIndex = Math.min(selectedPreviewIndex, previewIds.length - 1);
    if (nextIndex !== selectedPreviewIndex) {
      setSelectedPreviewIndex(nextIndex);
      return;
    }
    if (selectedRawId !== previewIds[nextIndex]) {
      setSelectedRawId(previewIds[nextIndex]);
    }
  }, [previewIds, selectedPreviewIndex, selectedRawId]);

  function updateProgress(title: string, result: RawDocumentBatchActionResult) {
    setBulkProgress({
      open: true,
      title,
      total: result.total,
      processed: result.processed,
      skipped: result.skipped,
      failed: result.failed,
      currentJob: result.results[result.results.length - 1]?.title ?? null,
      items: result.results.map((item) => ({
        title: item.title ?? `#${item.raw_document_id}`,
        status: item.message,
      })),
    });
  }

  async function refreshRunData(rawIdToReload?: number | null) {
    const nextRun = await fetchJson<CrawlRunInspection>(`/api/admin/crawl-runs/${run.run_id}/inspection`);
    setRun(nextRun);
    if (rawIdToReload) {
      const nextInspection = await fetchJson<RawDocumentInspection>(`/api/admin/raw-documents/${rawIdToReload}/inspection`);
      setInspection(nextInspection);
      setParserJson(pretty(asRecord(asRecord(nextInspection.section_parser).parsed_payload)));
    }
    return nextRun;
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(visibleIds));
  }

  function selectAllInRun() {
    setSelectedIds(new Set(run.pages.map((page) => page.raw_document_id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setSelectedPreviewIndex(0);
  }

  async function runBatchAction(action: BulkActionKey, ids: number[], label: string) {
    if (ids.length === 0) {
      setMessage(t.labels.noSelection);
      return null;
    }
    setMessage(null);
    setBulkActionRunning(true);
    setBulkProgress({
      open: true,
      title: label,
      total: ids.length,
      processed: 0,
      skipped: 0,
      failed: 0,
      currentJob: currentPage?.title ?? null,
      items: ids.map((id) => ({
        title: run.pages.find((page) => page.raw_document_id === id)?.title ?? `#${id}`,
        status: isEn ? "Waiting" : "অপেক্ষা করছে",
      })),
    });
    try {
      const result = await fetchJson<RawDocumentBatchActionResult>(`/api/admin/crawl-runs/${run.run_id}/batch/${action}`, {
        method: "POST",
        body: JSON.stringify({ raw_document_ids: ids }),
      });
      updateProgress(label, result);
      await refreshRunData(selectedRawId);
      setMessage(
        isEn
          ? `${label}: ${result.processed} success, ${result.skipped} skipped, ${result.failed} failed.`
          : `${label}: ${result.processed} সফল, ${result.skipped} স্কিপ, ${result.failed} সমস্যা।`,
      );
      return result;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setBulkActionRunning(false);
    }
  }

  async function saveParserEdits() {
    if (!inspection) return;
    try {
      const parsed = JSON.parse(parserJson);
      await fetchJson<RawDocumentActionResult>(`/api/admin/raw-documents/${inspection.raw_document_id}/save-parser-edits`, {
        method: "POST",
        body: JSON.stringify({ parsed_payload: parsed }),
      });
      await refreshRunData(inspection.raw_document_id);
      setMessage(isEn ? "Parser edits saved." : "পার্সার এডিট সেভ হয়েছে।");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveAiEdits() {
    if (!inspection) return;
    const payload: SaveAiEditsRequest = {
      validated_output: {
        ...asRecord(inspection.validated_ai_output),
        record_type: "job",
        title: editorState.title,
        title_bn: editorState.titleBn || null,
        summary_en: editorState.summaryEn || null,
        summary_bn: editorState.summaryBn || null,
        country: editorState.country || null,
        city: editorState.city || null,
        employer: editorState.employer || null,
        organization: editorState.organization || null,
        application_url: editorState.applicationUrl || null,
        salary_text: editorState.salaryText || null,
        deadline_text: editorState.deadlineText || null,
        eligibility_text: editorState.eligibilityText || null,
        requirements: asArray(editorState.requirements),
        responsibilities: asArray(editorState.responsibilities),
        journey_steps: asArray(editorState.journeySteps),
        documents_needed: asArray(editorState.documentsNeeded),
      },
    };
    try {
      await fetchJson<RawDocumentActionResult>(`/api/admin/raw-documents/${inspection.raw_document_id}/save-ai-edits`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setEditingAi(false);
      await refreshRunData(inspection.raw_document_id);
      setMessage(isEn ? "AI output saved." : "AI ফলাফল সেভ হয়েছে।");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function handlePrimaryAction(page: CrawlInspectionPageSummary) {
    setSelectedRawId(page.raw_document_id);
    if (stageFromPage(page) === "scraped") {
      await runBatchAction("parse-sections", [page.raw_document_id], t.actions.parse);
      setTab("parser");
      return;
    }
    if (page.ai_status === "ai_pending_admin" || page.parser_status === "parser_pending_admin" || page.parser_status === "parser_low_confidence") {
      await runBatchAction("run-ai", [page.raw_document_id], t.actions.sendToAi);
      setTab("output");
      return;
    }
    if (stageFromPage(page) === "ready_to_publish") {
      setSelectedIds(new Set([page.raw_document_id]));
      setShowPublishConfirm(true);
      setTab("preview");
      return;
    }
    if (page.publish_status === "published") {
      if (page.opportunity_id) {
        window.open(`/opportunity/${page.opportunity_id}`, "_blank", "noopener,noreferrer");
      }
      return;
    }
    setTab("parser");
  }

  async function processAllScrapedJobs() {
    setShowProcessAllModal(false);
    let nextRun = run;
    if (processAllOptions.runParser) {
      const ids = nextRun.pages.filter((page) => stageFromPage(page) === "scraped").map((page) => page.raw_document_id);
      const result = await runBatchAction("parse-sections", ids, t.actions.parseSelected);
      if (result) {
        nextRun = await fetchJson<CrawlRunInspection>(`/api/admin/crawl-runs/${run.run_id}/inspection`);
        setRun(nextRun);
      }
    }
    if (processAllOptions.runAi) {
      const ids = nextRun.pages.filter((page) => page.ai_status === "ai_pending_admin").map((page) => page.raw_document_id);
      const result = await runBatchAction("run-ai", ids, t.actions.sendSelectedToAi);
      if (result) {
        nextRun = await fetchJson<CrawlRunInspection>(`/api/admin/crawl-runs/${run.run_id}/inspection`);
        setRun(nextRun);
      }
    }
    if (processAllOptions.useFallback) {
      const ids = nextRun.pages
        .filter((page) => Boolean(page.parser_status) && page.ai_status !== "ai_completed_pending_publish" && page.ai_status !== "fallback_ready_pending_publish" && page.publish_status !== "published" && !page.failed_reason)
        .map((page) => page.raw_document_id);
      const result = await runBatchAction("use-fallback", ids, t.actions.useFallback);
      if (result) {
        nextRun = await fetchJson<CrawlRunInspection>(`/api/admin/crawl-runs/${run.run_id}/inspection`);
        setRun(nextRun);
      }
    }
    if (processAllOptions.publish) {
      const ids = nextRun.pages
        .filter((page) => stageFromPage(page) === "ready_to_publish" && page.parser_confidence >= 0.65)
        .map((page) => page.raw_document_id);
      await runBatchAction("publish", ids, t.actions.publishSelected);
    }
    await refreshRunData(selectedRawId);
  }

  async function confirmPublishSelection() {
    const readyPages = selectedPages.filter(isReadyToPublish);
    const reviewPages = selectedPages.filter((page) => !isReadyToPublish(page) && page.publish_status !== "published" && !page.failed_reason && Boolean(page.parser_status || page.ai_status));
    const failedPages = selectedPages.filter((page) => Boolean(page.failed_reason));
    setShowPublishConfirm(false);
    if (publishOptions.moveNeedsReview && reviewPages.length > 0) {
      await runBatchAction("mark-review", reviewPages.map((page) => page.raw_document_id), t.actions.markReview);
    }
    if (publishOptions.publishReady && readyPages.length > 0) {
      await runBatchAction("publish", readyPages.map((page) => page.raw_document_id), t.actions.publishSelected);
    }
    if (!publishOptions.skipFailed && failedPages.length > 0) {
      setMessage(isEn ? "Failed jobs were not published." : "সমস্যাযুক্ত চাকরি পাবলিশ করা হয়নি।");
    }
  }

  function exportSelectedReport() {
    if (selectedPages.length === 0) {
      setMessage(t.labels.noSelection);
      return;
    }
    const payload = selectedPages.map((page) => ({
      raw_document_id: page.raw_document_id,
      title: page.title,
      company: page.company,
      country: page.country,
      city: page.city,
      stage: stageFromPage(page),
      status_label: page.status_label,
      confidence: page.parser_confidence,
      recommended_action: page.recommended_action,
      last_result: page.last_result,
      key_info_flags: page.key_info_flags,
      warnings: page.warnings,
      failed_reason: page.failed_reason,
      source_url: page.source_url,
      final_url: page.final_url,
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `crawl-run-${run.run_id}-report.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const parserSection = asRecord(inspection?.section_parser);
  const parserPayload = asRecord(parserSection.parsed_payload);
  const aiInput = asRecord(inspection?.compact_ai_input);
  const aiOutput = asRecord(inspection?.validated_ai_output);
  const aiProblems = validationProblems(aiOutput, currentPage);
  const publishReady = currentPage ? stageFromPage(currentPage) === "ready_to_publish" : false;
  const sourceSections = Array.isArray(aiOutput.source_sections)
    ? aiOutput.source_sections
    : Array.isArray(aiInput.source_sections)
      ? aiInput.source_sections
      : parserPayload.raw_sections;

  const filterEntries = Object.entries(t.filters) as Array<[string, string]>;

  return (
    <div className="space-y-6 pb-28 md:pb-8">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{run.source_name}</h1>
              <p className="text-sm text-muted-foreground">
                {(run.connector_key ?? "official-source")} · {run.crawl_status ?? "unknown"}
              </p>
            </div>
            <p className="max-w-3xl rounded-xl bg-muted/60 px-4 py-3 text-sm text-foreground">{t.note}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={showDeveloperView ? "outline" : "default"} onClick={() => setShowDeveloperView(false)}>
              {t.actions.adminView}
            </Button>
            <Button variant={showDeveloperView ? "default" : "outline"} onClick={() => setShowDeveloperView(true)}>
              {t.actions.developerView}
            </Button>
            <Button variant="outline" onClick={() => refreshRunData(selectedRawId)} disabled={isPending || bulkActionRunning}>
              {t.actions.refresh}
            </Button>
          </div>
        </div>

        {!showDeveloperView ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-9">
              {[
                [t.sourceCards.crawlCompleted, run.finished_at ? 1 : 0],
                [t.sourceCards.jobsFound, run.detail_pages_followed],
                [t.sourceCards.parsed, run.parsed_count],
                [t.sourceCards.readyForAi, run.ready_for_ai_count],
                [t.sourceCards.aiCompleted, run.ai_completed_count],
                [t.sourceCards.readyToPublish, run.ready_to_publish_count],
                [t.sourceCards.published, run.published_count],
                [t.sourceCards.needsReview, run.needs_review_count],
                [t.sourceCards.failed, run.failed_count],
              ].map(([label, value]) => (
                <Card key={String(label)} className="py-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                </Card>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => setShowProcessAllModal(true)} disabled={bulkActionRunning || run.pages.length === 0}>
                {t.actions.processAll}
              </Button>
              {run.next_action_key === "send_ready_jobs_to_ai" ? (
                <Button
                  variant="outline"
                  onClick={() => runBatchAction("run-ai", run.pages.filter((page) => page.ai_status === "ai_pending_admin").map((page) => page.raw_document_id), t.actions.sendSelectedToAi)}
                >
                  {isEn ? `Send ${run.next_action_count} jobs to AI Brain` : `${run.next_action_count}টি চাকরি AI Brain এ পাঠান`}
                </Button>
              ) : null}
              {run.next_action_key === "publish_ready_jobs" ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedIds(new Set(run.pages.filter(isReadyToPublish).map((page) => page.raw_document_id)));
                    setShowPublishConfirm(true);
                  }}
                >
                  {isEn ? `Publish ${run.next_action_count} ready jobs` : `${run.next_action_count}টি প্রস্তুত চাকরি পাবলিশ করুন`}
                </Button>
              ) : null}
              {run.next_action_key === "review_failed_jobs" ? (
                <Button variant="outline" onClick={() => setFilter("failed")}>
                  {isEn ? `Review ${run.next_action_count} failed jobs` : `${run.next_action_count}টি সমস্যাযুক্ত চাকরি দেখুন`}
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t.labels.developerNote}</p>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        {([
          ["overview", t.tabs.overview],
          ["pages", t.tabs.pages],
          ["parser", t.tabs.parser],
          ["input", t.tabs.input],
          ["output", t.tabs.output],
          ["preview", t.tabs.preview],
        ] as Array<[TabKey, string]>).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${tab === key ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {message ? (
        <Card>
          <p className="text-sm text-foreground">{message}</p>
        </Card>
      ) : null}

      {tab === "overview" ? (
        <Card>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              <p><strong>{isEn ? "Started" : "শুরু"}:</strong> {run.started_at ?? "—"}</p>
              <p><strong>{isEn ? "Finished" : "শেষ"}:</strong> {run.finished_at ?? "—"}</p>
              <p><strong>{isEn ? "Source URL" : "সোর্স URL"}:</strong> {run.source_url ?? "—"}</p>
              <p><strong>{isEn ? "Connector" : "কনেক্টর"}:</strong> {run.connector_key ?? "—"}</p>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-foreground">{isEn ? "Skip reasons" : "স্কিপ কারণ"}</p>
                <pre className="overflow-x-auto rounded bg-muted/60 p-3 text-xs">{pretty(run.skip_reasons)}</pre>
              </div>
              <div>
                <p className="font-semibold text-foreground">{isEn ? "Fallback reasons" : "ফলব্যাক কারণ"}</p>
                <pre className="overflow-x-auto rounded bg-muted/60 p-3 text-xs">{pretty(run.fallback_reasons)}</pre>
              </div>
            </div>
          </div>
          {showDeveloperView ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div>
                <p className="font-semibold text-foreground">{isEn ? "Discovery diagnostics" : "ডিসকভারি ডায়াগনস্টিকস"}</p>
                <pre className="overflow-x-auto rounded bg-muted/60 p-3 text-xs">{pretty(run.discovery_diagnostics)}</pre>
              </div>
              <div>
                <p className="font-semibold text-foreground">{isEn ? "Extraction method counts" : "এক্সট্র্যাকশন কাউন্ট"}</p>
                <pre className="overflow-x-auto rounded bg-muted/60 p-3 text-xs">{pretty(run.extraction_method_counts)}</pre>
              </div>
              <div>
                <p className="font-semibold text-foreground">{isEn ? "Run logs" : "রান লগ"}</p>
                <pre className="overflow-x-auto rounded bg-muted/60 p-3 text-xs">{pretty(run.run_logs)}</pre>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      {tab === "pages" ? (
        <div className="space-y-4">
          {!showDeveloperView ? (
            <>
              <Card className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.labels.search} className="max-w-md" />
                  <div className="flex flex-wrap gap-2">
                    {filterEntries.map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFilter(key)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === key ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllVisible}>{t.actions.selectAllVisible}</Button>
                  <Button variant="outline" size="sm" onClick={selectAllInRun}>{t.actions.selectAllInRun}</Button>
                  <Button variant="outline" size="sm" onClick={clearSelection}>{t.actions.clearSelection}</Button>
                  <span className="text-sm text-muted-foreground">{selectedCountText(locale, selectedIds.size, t)}</span>
                </div>
              </Card>

              {selectedIds.size > 0 ? (
                <Card className="fixed bottom-0 left-0 right-0 z-20 rounded-none border-x-0 border-b-0 bg-background/95 backdrop-blur md:static md:rounded-2xl md:border md:border-border">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => runBatchAction("parse-sections", bulkActions.parse.ids, t.actions.parseSelected)} disabled={!bulkActions.parse.enabled || bulkActionRunning} title={bulkActions.parse.reason ?? ""}>
                      {t.actions.parseSelected}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => runBatchAction("run-ai", bulkActions.runAi.ids, t.actions.sendSelectedToAi)} disabled={!bulkActions.runAi.enabled || bulkActionRunning} title={bulkActions.runAi.reason ?? ""}>
                      {t.actions.sendSelectedToAi}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => runBatchAction("use-fallback", bulkActions.fallback.ids, t.actions.useFallback)} disabled={!bulkActions.fallback.enabled || bulkActionRunning} title={bulkActions.fallback.reason ?? ""}>
                      {t.actions.useFallback}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowPublishConfirm(true)} disabled={!bulkActions.publish.enabled || bulkActionRunning} title={bulkActions.publish.reason ?? ""}>
                      {t.actions.publishSelected}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => runBatchAction("mark-review", bulkActions.review.ids, t.actions.markReview)} disabled={!bulkActions.review.enabled || bulkActionRunning} title={bulkActions.review.reason ?? ""}>
                      {t.actions.markReview}
                    </Button>
                    <Button size="sm" variant="outline" onClick={exportSelectedReport} disabled={!bulkActions.export.enabled || bulkActionRunning}>
                      {t.actions.exportReport}
                    </Button>
                  </div>
                </Card>
              ) : null}

              {filteredPages.length === 0 ? (
                <Card>
                  <p className="text-sm text-muted-foreground">{t.labels.noItems}</p>
                </Card>
              ) : (
                <>
                  <Card className="hidden overflow-hidden p-0 md:block">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            {["", isEn ? "Job title" : "চাকরির নাম", t.labels.stage, t.labels.confidence, t.labels.keyInfo, t.labels.recommendedAction, t.labels.lastResult, t.labels.actions].map((header) => (
                              <th key={header} className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filteredPages.map((page) => (
                            <tr key={page.raw_document_id} className="align-top">
                              <td className="px-3 py-3">
                                <input type="checkbox" className="h-4 w-4 accent-primary" checked={selectedIds.has(page.raw_document_id)} onChange={() => toggleSelect(page.raw_document_id)} />
                              </td>
                              <td className="px-3 py-3">
                                <p className="font-semibold text-foreground">{page.title ?? "Untitled"}</p>
                                <p className="text-xs text-muted-foreground">{page.company ?? "—"} · {page.country ?? "—"}{page.city ? ` / ${page.city}` : ""}</p>
                              </td>
                              <td className="px-3 py-3">
                                <Badge className={toneClass(page.status_tone)}>{t.stageLabels[stageFromPage(page) as keyof typeof t.stageLabels] ?? page.stage}</Badge>
                                <p className="mt-2 text-xs text-muted-foreground">{t.statusLabels[(page.failed_reason ? "failed" : page.publish_status || page.ai_status || page.parser_status || "scraped") as keyof typeof t.statusLabels] ?? page.status_label}</p>
                              </td>
                              <td className="px-3 py-3">
                                <span className={page.parser_confidence >= 0.65 ? "text-green-700" : "text-amber-700"}>{page.parser_confidence.toFixed(2)}</span>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex max-w-[360px] flex-wrap gap-1">
                                  {Object.entries(page.key_info_flags).map(([key, value]) => (
                                    <span key={key} className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${keyInfoClass(value)}`}>
                                      {t.keyInfo[key as keyof typeof t.keyInfo]}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-sm text-foreground">{page.recommended_action}</td>
                              <td className="px-3 py-3 text-sm text-muted-foreground">{page.last_result ?? "—"}</td>
                              <td className="px-3 py-3">
                                <div className="flex flex-col gap-2">
                                  <Button size="sm" onClick={() => handlePrimaryAction(page)}>{primaryActionLabel(page, t.actions, isEn)}</Button>
                                  <details className="rounded-md border border-border bg-muted/30 p-2">
                                    <summary className="cursor-pointer text-xs font-semibold text-foreground">{t.labels.actions}</summary>
                                    <div className="mt-2 flex flex-col gap-2">
                                      <Button size="sm" variant="outline" onClick={() => { setSelectedRawId(page.raw_document_id); setTab("parser"); }}>{t.actions.inspect}</Button>
                                      <Button size="sm" variant="outline" onClick={() => runBatchAction("parse-sections", [page.raw_document_id], t.actions.recheck)}>{t.actions.recheck}</Button>
                                      <Button size="sm" variant="outline" onClick={() => runBatchAction("run-ai", [page.raw_document_id], t.actions.sendToAi)}>{t.actions.sendToAi}</Button>
                                      <Button size="sm" variant="outline" onClick={() => runBatchAction("use-fallback", [page.raw_document_id], t.actions.useFallback)}>{t.actions.useFallback}</Button>
                                      <Button size="sm" variant="outline" onClick={() => { setSelectedRawId(page.raw_document_id); setTab("preview"); }}>{t.actions.preview}</Button>
                                      <Button size="sm" variant="outline" onClick={() => { setSelectedIds(new Set([page.raw_document_id])); setShowPublishConfirm(true); }}>{t.actions.publish}</Button>
                                      <Button size="sm" variant="outline" onClick={() => runBatchAction("mark-review", [page.raw_document_id], t.actions.markReview)}>{t.actions.markReview}</Button>
                                      <a href={page.final_url ?? page.source_url} target="_blank" rel="noopener noreferrer" className="rounded-md border border-border px-3 py-2 text-center text-xs font-semibold text-foreground hover:border-primary hover:text-primary">
                                        {t.actions.openPage}
                                      </a>
                                      <details className="rounded-md bg-background p-2">
                                        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">{t.labels.advancedDetails}</summary>
                                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                          <p>URL: {page.source_url}</p>
                                          <p>Final URL: {page.final_url ?? "—"}</p>
                                          <p>Text length: {page.raw_text_length}</p>
                                          <p>HTML captured: {page.html_captured ? "true" : "false"}</p>
                                          <p>Parser: {page.parser_status ?? "—"}</p>
                                          <p>AI: {page.ai_status ?? "—"}</p>
                                          <p>Publish: {page.publish_status ?? "—"}</p>
                                        </div>
                                      </details>
                                    </div>
                                  </details>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  <div className="grid gap-3 md:hidden">
                    {filteredPages.map((page) => (
                      <Card key={page.raw_document_id} className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex gap-3">
                            <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={selectedIds.has(page.raw_document_id)} onChange={() => toggleSelect(page.raw_document_id)} />
                            <div>
                              <p className="font-semibold text-foreground">{page.title ?? "Untitled"}</p>
                              <p className="text-xs text-muted-foreground">{page.company ?? "—"} · {page.country ?? "—"}{page.city ? ` / ${page.city}` : ""}</p>
                            </div>
                          </div>
                          <Badge className={toneClass(page.status_tone)}>{t.stageLabels[stageFromPage(page) as keyof typeof t.stageLabels] ?? page.stage}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(page.key_info_flags).map(([key, value]) => (
                            <span key={key} className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${keyInfoClass(value)}`}>
                              {t.keyInfo[key as keyof typeof t.keyInfo]}
                            </span>
                          ))}
                        </div>
                        <div className="space-y-1 text-sm">
                          <p><strong>{t.labels.confidence}:</strong> {page.parser_confidence.toFixed(2)}</p>
                          <p><strong>{t.labels.recommendedAction}:</strong> {page.recommended_action}</p>
                          <p><strong>{t.labels.lastResult}:</strong> {page.last_result ?? "—"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => handlePrimaryAction(page)}>{primaryActionLabel(page, t.actions, isEn)}</Button>
                          <Button size="sm" variant="outline" onClick={() => { setSelectedRawId(page.raw_document_id); setTab("parser"); }}>{t.actions.inspect}</Button>
                          <Button size="sm" variant="outline" onClick={() => runBatchAction("mark-review", [page.raw_document_id], t.actions.markReview)}>{t.actions.markReview}</Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {["Job title", "URL", "Final URL", "Text len", "HTML", "Parser", "AI", "Publish", "Inspect"].map((header) => (
                        <th key={header} className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {run.pages.map((page) => (
                      <tr key={page.raw_document_id}>
                        <td className="px-3 py-3">{page.title ?? "Untitled"}</td>
                        <td className="max-w-[240px] break-all px-3 py-3 text-xs text-muted-foreground">{page.source_url}</td>
                        <td className="max-w-[240px] break-all px-3 py-3 text-xs text-muted-foreground">{page.final_url ?? "—"}</td>
                        <td className="px-3 py-3">{page.raw_text_length}</td>
                        <td className="px-3 py-3">{page.html_captured ? "true" : "false"}</td>
                        <td className="px-3 py-3">{page.parser_status ?? "—"}</td>
                        <td className="px-3 py-3">{page.ai_status ?? "—"}</td>
                        <td className="px-3 py-3">{page.publish_status ?? "—"}</td>
                        <td className="px-3 py-3">
                          <Button size="sm" variant="outline" onClick={() => { setSelectedRawId(page.raw_document_id); setTab("parser"); }}>{t.actions.inspect}</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      ) : null}

      {inspection && tab === "parser" ? (
        <Card className="space-y-4">
          {!showDeveloperView ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard title={isEn ? "Basic Info" : "বেসিক তথ্য"} rows={[
                  ["Title", toText(parserPayload.title)],
                  ["Company", toText(parserPayload.company)],
                  ["Country", toText(parserPayload.country)],
                  ["City", toText(parserPayload.city)],
                  ["Department", toText(parserPayload.department)],
                  ["Apply URL", toText(parserPayload.apply_url)],
                ]} />
                <InfoCard title={isEn ? "Job Summary Source" : "জব সামারি সোর্স"} text={toText(parserPayload.job_purpose)} />
              </div>
              <ListCard title={isEn ? "Responsibilities Found" : "পাওয়া দায়িত্ব"} items={asArray(parserPayload.responsibilities).concat(asArray(parserPayload.key_accountabilities)).concat(asArray(parserPayload.role_accountabilities))} />
              <ListCard title={isEn ? "Requirements Found" : "পাওয়া রিকোয়ারমেন্ট"} items={asArray(parserPayload.qualifications).concat(asArray(parserPayload.work_experience)).concat(asArray(parserPayload.education)).concat(asArray(parserPayload.work_permit_or_iqama))} />
              <ListCard title={isEn ? "Skills Found" : "পাওয়া স্কিল"} items={asArray(parserPayload.technical_skills).concat(asArray(parserPayload.competencies))} />
              <ListCard title={t.labels.noiseRemoved} items={asArray(parserSection.ignored_noise_lines)} collapsible />
              <ListCard title={t.labels.parserWarnings} items={asArray(parserSection.warnings)} collapsible />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => runBatchAction("parse-sections", [inspection.raw_document_id], t.actions.recheck)} disabled={bulkActionRunning}>{t.actions.recheck}</Button>
                <Button variant="outline" onClick={() => runBatchAction("run-ai", [inspection.raw_document_id], t.actions.sendToAi)} disabled={bulkActionRunning}>{t.actions.sendToAi}</Button>
                <Button variant="outline" onClick={() => setShowRawParserJson((prev) => !prev)}>{t.actions.showRawParserJson}</Button>
              </div>
              {showRawParserJson ? (
                <pre className="max-h-[420px] overflow-auto rounded bg-muted/60 p-3 text-xs">{pretty(parserSection)}</pre>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => runBatchAction("parse-sections", [inspection.raw_document_id], t.actions.recheck)} disabled={bulkActionRunning}>{t.actions.recheck}</Button>
                <Button variant="outline" onClick={() => runBatchAction("run-ai", [inspection.raw_document_id], t.actions.sendToAi)} disabled={bulkActionRunning}>{t.actions.sendToAi}</Button>
              </div>
              <pre className="max-h-[520px] overflow-auto rounded bg-muted/60 p-3 text-xs">{pretty(inspection.section_parser)}</pre>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">{isEn ? "Edit parsed JSON" : "পার্সড JSON এডিট"}</span>
                <textarea className="min-h-[320px] w-full rounded-md border border-border bg-background p-3 font-mono text-xs" value={parserJson} onChange={(event) => setParserJson(event.target.value)} />
              </label>
              <Button variant="outline" onClick={saveParserEdits} disabled={bulkActionRunning}>{isEn ? "Save parser edits" : "পার্সার এডিট সেভ করুন"}</Button>
            </>
          )}
        </Card>
      ) : null}

      {inspection && tab === "input" ? (
        <Card className="space-y-4">
          {!showDeveloperView ? (
            <>
              <p className="text-sm text-muted-foreground">{isEn ? "AI Brain will receive this clean information." : "AI Brain এই পরিষ্কার তথ্য পাবে।"}</p>
              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard title={isEn ? "Job identity" : "জব পরিচিতি"} rows={[
                  ["Title", toText(aiInput.title)],
                  ["Company", toText(aiInput.company)],
                  ["Department", toText(aiInput.department)],
                  ["Apply URL", toText(aiInput.apply_url)],
                ]} />
                <InfoCard title={isEn ? "Location" : "লোকেশন"} rows={[
                  ["Country", toText(aiInput.country)],
                  ["City", toText(aiInput.city)],
                  ["Posted", toText(aiInput.posted_date)],
                ]} />
              </div>
              <ListCard title={isEn ? "Responsibilities" : "দায়িত্ব"} items={asArray(aiInput.responsibilities).concat(asArray(aiInput.key_accountabilities)).concat(asArray(aiInput.role_accountabilities))} />
              <ListCard title={isEn ? "Requirements" : "রিকোয়ারমেন্ট"} items={asArray(aiInput.qualifications).concat(asArray(aiInput.technical_skills)).concat(asArray(aiInput.competencies))} />
              <ListCard title={isEn ? "Work permit or iqama" : "ওয়ার্ক পারমিট বা ইকামা"} items={asArray(aiInput.work_permit_or_iqama)} />
              <ListCard title={t.labels.missingFields} items={missingAiFields(aiInput)} />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => runBatchAction("run-ai", [inspection.raw_document_id], t.actions.sendToAi)} disabled={bulkActionRunning}>{t.actions.sendToAi}</Button>
                <Button variant="outline" onClick={() => setShowCompactAiJson((prev) => !prev)}>{t.actions.showCompactAiJson}</Button>
              </div>
              {showCompactAiJson ? (
                <pre className="max-h-[520px] overflow-auto rounded bg-muted/60 p-3 text-xs">{pretty(inspection.compact_ai_input)}</pre>
              ) : null}
            </>
          ) : (
            <pre className="max-h-[520px] overflow-auto rounded bg-muted/60 p-3 text-xs">{pretty(inspection.compact_ai_input)}</pre>
          )}
        </Card>
      ) : null}

      {inspection && tab === "output" ? (
        <Card className="space-y-4">
          {!showDeveloperView ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard title={isEn ? "Bangla summary" : "বাংলা সারসংক্ষেপ"} text={toText(aiOutput.summary_bn)} />
                <InfoCard title={isEn ? "English summary" : "ইংরেজি সারসংক্ষেপ"} text={toText(aiOutput.summary_en)} />
              </div>
              <ListCard title={isEn ? "Requirements" : "রিকোয়ারমেন্ট"} items={asArray(aiOutput.requirements)} />
              <ListCard title={isEn ? "Responsibilities" : "দায়িত্ব"} items={asArray(aiOutput.responsibilities)} />
              <ListCard title={isEn ? "Eligibility" : "যোগ্যতা"} items={asArray(aiOutput.eligibility_text)} />
              <ListCard title={isEn ? "Application steps" : "আবেদন ধাপ"} items={asArray(aiOutput.journey_steps)} />
              <ListCard title={isEn ? "Documents needed" : "প্রয়োজনীয় কাগজ"} items={asArray(aiOutput.documents_needed)} />
              <ListCard title={t.labels.warnings} items={asArray(inspection.warnings)} collapsible />

              <Card className="border-dashed">
                <p className="text-sm font-semibold text-foreground">{t.labels.ready}</p>
                <p className="mt-1 text-sm text-muted-foreground">{isEn ? `${t.labels.yes}: ${publishReady ? "Yes" : "No"}` : `${t.labels.yes}: ${publishReady ? "হ্যাঁ" : "না"}`}</p>
                <div className="mt-3">
                  <p className="text-sm font-semibold text-foreground">{t.labels.problems}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {aiProblems.length > 0 ? aiProblems.map((problem) => <li key={problem}>{problem}</li>) : <li>{isEn ? "No blocking problems found." : "বাধা তৈরির মতো সমস্যা পাওয়া যায়নি।"}</li>}
                  </ul>
                </div>
              </Card>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setTab("preview")}>{t.actions.acceptAiOutput}</Button>
                <Button variant="outline" onClick={() => runBatchAction("run-ai", [inspection.raw_document_id], t.actions.rerunAi)}>{t.actions.rerunAi}</Button>
                <Button variant="outline" onClick={() => runBatchAction("use-fallback", [inspection.raw_document_id], t.actions.useFallback)}>{t.actions.useFallback}</Button>
                <Button variant="outline" onClick={() => setEditingAi((prev) => !prev)}>{t.actions.editFields}</Button>
                <Button variant="outline" onClick={() => setShowRawAiResponse((prev) => !prev)}>{t.actions.showRawAiResponse}</Button>
              </div>

              {editingAi ? (
                <Card className="space-y-4 border-dashed">
                  <div className="grid gap-3 md:grid-cols-2">
                    <LabeledInput label={isEn ? "Title" : "টাইটেল"} value={editorState.title} onChange={(value) => setEditorState((prev) => ({ ...prev, title: value }))} />
                    <LabeledInput label={isEn ? "Bangla title" : "বাংলা টাইটেল"} value={editorState.titleBn} onChange={(value) => setEditorState((prev) => ({ ...prev, titleBn: value }))} />
                    <LabeledInput label={isEn ? "Country" : "দেশ"} value={editorState.country} onChange={(value) => setEditorState((prev) => ({ ...prev, country: value }))} />
                    <LabeledInput label={isEn ? "City" : "শহর"} value={editorState.city} onChange={(value) => setEditorState((prev) => ({ ...prev, city: value }))} />
                    <LabeledInput label={isEn ? "Employer" : "নিয়োগকর্তা"} value={editorState.employer} onChange={(value) => setEditorState((prev) => ({ ...prev, employer: value }))} />
                    <LabeledInput label={isEn ? "Organization" : "অর্গানাইজেশন"} value={editorState.organization} onChange={(value) => setEditorState((prev) => ({ ...prev, organization: value }))} />
                    <LabeledInput label={isEn ? "Apply URL" : "আবেদন লিংক"} value={editorState.applicationUrl} onChange={(value) => setEditorState((prev) => ({ ...prev, applicationUrl: value }))} />
                    <LabeledInput label={isEn ? "Salary text" : "বেতন"} value={editorState.salaryText} onChange={(value) => setEditorState((prev) => ({ ...prev, salaryText: value }))} />
                    <LabeledInput label={isEn ? "Deadline text" : "ডেডলাইন"} value={editorState.deadlineText} onChange={(value) => setEditorState((prev) => ({ ...prev, deadlineText: value }))} />
                    <LabeledTextarea label={isEn ? "Eligibility" : "যোগ্যতা"} value={editorState.eligibilityText} onChange={(value) => setEditorState((prev) => ({ ...prev, eligibilityText: value }))} />
                    <LabeledTextarea label={isEn ? "English summary" : "ইংরেজি সারসংক্ষেপ"} value={editorState.summaryEn} onChange={(value) => setEditorState((prev) => ({ ...prev, summaryEn: value }))} />
                    <LabeledTextarea label={isEn ? "Bangla summary" : "বাংলা সারসংক্ষেপ"} value={editorState.summaryBn} onChange={(value) => setEditorState((prev) => ({ ...prev, summaryBn: value }))} />
                    <LabeledTextarea label={isEn ? "Requirements" : "রিকোয়ারমেন্ট"} value={editorState.requirements} onChange={(value) => setEditorState((prev) => ({ ...prev, requirements: value }))} />
                    <LabeledTextarea label={isEn ? "Responsibilities" : "দায়িত্ব"} value={editorState.responsibilities} onChange={(value) => setEditorState((prev) => ({ ...prev, responsibilities: value }))} />
                    <LabeledTextarea label={isEn ? "Application steps" : "আবেদন ধাপ"} value={editorState.journeySteps} onChange={(value) => setEditorState((prev) => ({ ...prev, journeySteps: value }))} />
                    <LabeledTextarea label={isEn ? "Documents needed" : "প্রয়োজনীয় কাগজ"} value={editorState.documentsNeeded} onChange={(value) => setEditorState((prev) => ({ ...prev, documentsNeeded: value }))} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={saveAiEdits} disabled={bulkActionRunning}>{t.actions.saveAiEdits}</Button>
                    <Button variant="outline" onClick={() => setEditingAi(false)}>{t.modal.cancel}</Button>
                  </div>
                </Card>
              ) : null}

              {showRawAiResponse ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <pre className="max-h-[320px] overflow-auto rounded bg-muted/60 p-3 text-xs">{pretty(inspection.raw_ai_output)}</pre>
                  <pre className="max-h-[320px] overflow-auto rounded bg-muted/60 p-3 text-xs">{pretty(inspection.validated_ai_output)}</pre>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => runBatchAction("run-ai", [inspection.raw_document_id], t.actions.rerunAi)}>{t.actions.rerunAi}</Button>
                <Button variant="outline" onClick={() => runBatchAction("use-fallback", [inspection.raw_document_id], t.actions.useFallback)}>{t.actions.useFallback}</Button>
              </div>
              <p className="text-sm font-medium text-foreground">Raw AI JSON</p>
              <pre className="max-h-[240px] overflow-auto rounded bg-muted/60 p-3 text-xs">{pretty(inspection.raw_ai_output)}</pre>
              <p className="text-sm font-medium text-foreground">Validated JSON</p>
              <pre className="max-h-[320px] overflow-auto rounded bg-muted/60 p-3 text-xs">{pretty(inspection.validated_ai_output)}</pre>
              <p className="text-sm font-medium text-foreground">Warnings</p>
              <pre className="overflow-auto rounded bg-muted/60 p-3 text-xs">{pretty(inspection.warnings)}</pre>
            </>
          )}
        </Card>
      ) : null}

      {inspection && tab === "preview" ? (
        <Card className="space-y-4">
          {!showDeveloperView ? (
            <>
              {previewIds.length > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-4 py-3 text-sm">
                  <span>{t.labels.previewing} {selectedPreviewIndex + 1} {t.labels.of} {previewIds.length}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedPreviewIndex((prev) => Math.max(0, prev - 1))} disabled={selectedPreviewIndex === 0}>{isEn ? "Previous" : "আগেরটি"}</Button>
                    <Button variant="outline" size="sm" onClick={() => setSelectedPreviewIndex((prev) => Math.min(previewIds.length - 1, prev + 1))} disabled={selectedPreviewIndex >= previewIds.length - 1}>{isEn ? "Next" : "পরেরটি"}</Button>
                  </div>
                </div>
              ) : null}

              <div className="space-y-4 rounded-2xl border border-border bg-background p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoCard title={isEn ? "Title" : "টাইটেল"} text={toText(aiOutput.title)} />
                  <InfoCard title={isEn ? "Employer" : "নিয়োগকর্তা"} text={toText(aiOutput.employer) || toText(aiOutput.organization)} />
                  <InfoCard title={isEn ? "Country" : "দেশ"} text={toText(aiOutput.country)} />
                  <InfoCard title={isEn ? "Deadline" : "ডেডলাইন"} text={toText(aiOutput.deadline_text)} />
                  <InfoCard title={isEn ? "Salary" : "বেতন"} text={toText(aiOutput.salary_text)} />
                  <InfoCard title={isEn ? "Trust source" : "বিশ্বস্ত উৎস"} text={run.source_name ?? "—"} />
                </div>
                <InfoCard title={isEn ? "Bangla summary" : "বাংলা সারসংক্ষেপ"} text={toText(aiOutput.summary_bn)} />
                <InfoCard title={isEn ? "English summary" : "ইংরেজি সারসংক্ষেপ"} text={toText(aiOutput.summary_en)} />
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoCard title={isEn ? "Can apply from Bangladesh" : "বাংলাদেশ থেকে আবেদন করা যাবে"} text={String(aiOutput.can_apply_from_bd ?? "Unknown")} />
                  <InfoCard title={isEn ? "Work permit required" : "ওয়ার্ক পারমিট দরকার"} text={toText(aiOutput.eligibility_text)} />
                </div>
                <ListCard title={isEn ? "Requirements" : "রিকোয়ারমেন্ট"} items={asArray(aiOutput.requirements)} />
                <ListCard title={isEn ? "Responsibilities" : "দায়িত্ব"} items={asArray(aiOutput.responsibilities)} />
                <ListCard title={isEn ? "Application steps" : "আবেদন ধাপ"} items={asArray(aiOutput.journey_steps)} />
                <ListCard title={isEn ? "Documents needed" : "প্রয়োজনীয় কাগজ"} items={asArray(aiOutput.documents_needed)} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setShowPublishConfirm(true)} disabled={!publishReady}>{t.actions.publish}</Button>
                <Button variant="outline" onClick={() => runBatchAction("mark-review", [inspection.raw_document_id], t.actions.savePendingReview)}>{t.actions.savePendingReview}</Button>
                <Button variant="outline" onClick={() => setEditingAi(true)}>{t.actions.editFields}</Button>
                <Button variant="outline" onClick={() => setTab("output")}>{t.actions.backToAi}</Button>
              </div>
            </>
          ) : (
            <pre className="max-h-[520px] overflow-auto rounded bg-muted/60 p-3 text-xs">{pretty(aiOutput)}</pre>
          )}
        </Card>
      ) : null}

      {!inspection && tab !== "overview" && tab !== "pages" ? (
        <Card>
          <p className="text-sm text-muted-foreground">{t.labels.noInspection}</p>
        </Card>
      ) : null}

      {showProcessAllModal ? (
        <Modal title={t.modal.processAllTitle} onClose={() => setShowProcessAllModal(false)}>
          <div className="space-y-3 text-sm">
            <CheckRow label={t.modal.runParser} checked={processAllOptions.runParser} onChange={() => setProcessAllOptions((prev) => ({ ...prev, runParser: !prev.runParser }))} />
            <CheckRow label={t.modal.runAi} checked={processAllOptions.runAi} onChange={() => setProcessAllOptions((prev) => ({ ...prev, runAi: !prev.runAi }))} />
            <CheckRow label={t.modal.useFallback} checked={processAllOptions.useFallback} onChange={() => setProcessAllOptions((prev) => ({ ...prev, useFallback: !prev.useFallback }))} />
            <CheckRow label={t.modal.publish} checked={processAllOptions.publish} onChange={() => setProcessAllOptions((prev) => ({ ...prev, publish: !prev.publish }))} />
            <div className="flex gap-2 pt-2">
              <Button onClick={processAllScrapedJobs}>{t.modal.start}</Button>
              <Button variant="outline" onClick={() => setShowProcessAllModal(false)}>{t.modal.cancel}</Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {showPublishConfirm ? (
        <Modal title={t.modal.publishTitle} onClose={() => setShowPublishConfirm(false)}>
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 md:grid-cols-3">
              <Card className="py-4 text-center"><p className="text-xl font-bold">{selectedPages.filter(isReadyToPublish).length}</p><p className="text-xs text-muted-foreground">{t.modal.readyCount}</p></Card>
              <Card className="py-4 text-center"><p className="text-xl font-bold">{selectedPages.filter((page) => !isReadyToPublish(page) && page.publish_status !== "published" && !page.failed_reason && Boolean(page.parser_status || page.ai_status)).length}</p><p className="text-xs text-muted-foreground">{t.modal.reviewCount}</p></Card>
              <Card className="py-4 text-center"><p className="text-xl font-bold">{selectedPages.filter((page) => Boolean(page.failed_reason)).length}</p><p className="text-xs text-muted-foreground">{t.modal.failedCount}</p></Card>
            </div>
            <CheckRow label={t.modal.publishReady} checked={publishOptions.publishReady} onChange={() => setPublishOptions((prev) => ({ ...prev, publishReady: !prev.publishReady }))} />
            <CheckRow label={t.modal.moveNeedsReview} checked={publishOptions.moveNeedsReview} onChange={() => setPublishOptions((prev) => ({ ...prev, moveNeedsReview: !prev.moveNeedsReview }))} />
            <CheckRow label={t.modal.skipFailed} checked={publishOptions.skipFailed} onChange={() => setPublishOptions((prev) => ({ ...prev, skipFailed: !prev.skipFailed }))} />
            <div className="flex gap-2">
              <Button onClick={confirmPublishSelection}>{t.modal.confirmPublish}</Button>
              <Button variant="outline" onClick={() => setShowPublishConfirm(false)}>{t.modal.cancel}</Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {bulkProgress.open ? (
        <Modal title={`${t.labels.processing} ${bulkProgress.total} ${isEn ? "jobs" : "টি চাকরি"}`} onClose={() => setBulkProgress((prev) => ({ ...prev, open: false }))}>
          <div className="space-y-3 text-sm">
            <p className="font-semibold text-foreground">{bulkProgress.title}</p>
            <div className="grid gap-3 md:grid-cols-4">
              <Card className="py-3 text-center"><p className="text-lg font-bold">{bulkProgress.processed}</p><p className="text-xs text-muted-foreground">{isEn ? "Processed" : "প্রসেসড"}</p></Card>
              <Card className="py-3 text-center"><p className="text-lg font-bold">{bulkProgress.skipped}</p><p className="text-xs text-muted-foreground">{isEn ? "Skipped" : "স্কিপ"}</p></Card>
              <Card className="py-3 text-center"><p className="text-lg font-bold">{bulkProgress.failed}</p><p className="text-xs text-muted-foreground">{isEn ? "Failed" : "সমস্যা"}</p></Card>
              <Card className="py-3 text-center"><p className="text-lg font-bold">{bulkProgress.total}</p><p className="text-xs text-muted-foreground">{isEn ? "Total" : "মোট"}</p></Card>
            </div>
            <p><strong>{t.labels.currentJob}:</strong> {bulkProgress.currentJob ?? "—"}</p>
            <div className="max-h-64 space-y-2 overflow-auto rounded-xl bg-muted/40 p-3">
              {bulkProgress.items.map((item) => (
                <div key={`${item.title}-${item.status}`} className="flex items-start justify-between gap-3 rounded-lg bg-background px-3 py-2 text-xs">
                  <span className="font-medium text-foreground">{item.title}</span>
                  <span className="text-muted-foreground">{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function primaryActionLabel(page: CrawlInspectionPageSummary, actions: typeof TEXT.en.actions | typeof TEXT.bn.actions, isEn: boolean) {
  if (stageFromPage(page) === "scraped") return actions.parse;
  if (page.ai_status === "ai_pending_admin" || page.parser_status === "parser_pending_admin" || page.parser_status === "parser_low_confidence") return actions.sendToAi;
  if (stageFromPage(page) === "ready_to_publish") return actions.publish;
  if (page.publish_status === "published") return actions.viewPublicPage;
  return isEn ? "Review" : "রিভিউ";
}

function missingAiFields(input: Record<string, unknown>): string[] {
  const checks: Array<[string, unknown]> = [
    ["Title", input.title],
    ["Country", input.country],
    ["City", input.city],
    ["Responsibilities", input.responsibilities],
    ["Requirements", input.qualifications],
    ["Apply URL", input.apply_url],
  ];
  return checks.filter(([, value]) => !value || (Array.isArray(value) && value.length === 0)).map(([label]) => label);
}

function InfoCard({ title, text, rows }: { title: string; text?: string; rows?: Array<[string, string]> }) {
  return (
    <Card className="space-y-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {rows ? (
        <div className="space-y-2 text-sm">
          {rows.map(([label, value]) => (
            <p key={label}><strong>{label}:</strong> {value || "—"}</p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{text || "—"}</p>
      )}
    </Card>
  );
}

function ListCard({ title, items, collapsible = false }: { title: string; items: string[]; collapsible?: boolean }) {
  if (collapsible) {
    return (
      <details className="rounded-2xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">{title}</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {items.length > 0 ? items.map((item) => <li key={`${title}-${item}`}>{item}</li>) : <li>—</li>}
        </ul>
      </details>
    );
  }
  return (
    <Card className="space-y-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {items.length > 0 ? items.map((item) => <li key={`${title}-${item}`}>{item}</li>) : <li>—</li>}
      </ul>
    </Card>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function LabeledTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <textarea
        className="min-h-[110px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-3">
      <input type="checkbox" className="h-4 w-4 accent-primary" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-border bg-background p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <button type="button" className="rounded-md border border-border px-3 py-1 text-sm" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
