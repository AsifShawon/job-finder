import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type UiLocale = "bn" | "en";

export function formatDate(value: string | null | undefined, locale: UiLocale = "bn"): string {
  if (!value) {
    return locale === "en" ? "Not available" : "উপলভ্য নয়";
  }
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "bn-BD", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined, locale: UiLocale = "bn"): string {
  if (!value) {
    return locale === "en" ? "Not available" : "উপলভ্য নয়";
  }
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "bn-BD", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function humanizeSlug(value: string, locale: UiLocale = "bn"): string {
  const labels: Record<UiLocale, Record<string, string>> = {
    en: {
      official_gov: "Government source",
      official_partner: "Official partner",
      established_portal: "Established portal",
      news_only: "News-based",
      running: "Running",
      completed: "Completed",
      success: "Successful",
      failed: "Failed",
      queued: "Queued",
      pending: "Pending",
      job: "Job",
      scholarship: "Scholarship",
      policy_update: "Policy update",
      static_html: "Static HTML",
      dynamic_html: "Dynamic HTML",
      news_policy: "News and policy",
    },
    bn: {
      official_gov: "সরকারি উৎস",
      official_partner: "সরকারি অংশীদার",
      established_portal: "প্রতিষ্ঠিত পোর্টাল",
      news_only: "সংবাদভিত্তিক",
      running: "চলমান",
      completed: "সম্পন্ন",
      success: "সফল",
      failed: "ব্যর্থ",
      queued: "অপেক্ষমাণ",
      pending: "অপেক্ষমাণ",
      job: "চাকরি",
      scholarship: "বৃত্তি",
      policy_update: "নীতি আপডেট",
      static_html: "স্ট্যাটিক HTML",
      dynamic_html: "ডাইনামিক HTML",
      news_policy: "সংবাদ ও নীতি",
    },
  };

  if (labels[locale][value]) {
    return labels[locale][value];
  }

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getSafeNextPath(next: string | null | undefined): string {
  if (!next) return "/dashboard";

  // Clean next by decoding first to prevent bypasses using double encoding
  let decoded = next;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    // Ignore decoding errors
  }

  // Ensure it starts with / and is not a protocol-relative URL (which starts with // or /\, or similar)
  if (decoded.startsWith("/") && !decoded.startsWith("//") && !decoded.startsWith("/\\")) {
    return decoded;
  }

  return "/dashboard";
}

