import type { Locale } from "./i18n-shared";
import { formatDate } from "./utils";

const BANGLA_CHAR_RE = /[\u0980-\u09FF]/u;
const URL_RE = /(https?:\/\/\S+|www\.\S+)/gi;
const MULTI_SPACE_RE = /\s+/g;

const KNOWN_BANGLA_VALUES: Record<string, string> = {
  bangladesh: "বাংলাদেশ",
  malaysia: "মালয়েশিয়া",
  canada: "কানাডা",
  germany: "জার্মানি",
  "saudi arabia": "সৌদি আরব",
  qatar: "কাতার",
  oman: "ওমান",
  bahrain: "বাহরাইন",
  kuwait: "কুয়েত",
  "united arab emirates": "সংযুক্ত আরব আমিরাত",
  uae: "সংযুক্ত আরব আমিরাত",
  singapore: "সিঙ্গাপুর",
  japan: "জাপান",
  "south korea": "দক্ষিণ কোরিয়া",
  korea: "কোরিয়া",
  romania: "রোমানিয়া",
  italy: "ইতালি",
  poland: "পোল্যান্ড",
  portugal: "পর্তুগাল",
  croatia: "ক্রোয়েশিয়া",
  greece: "গ্রিস",
  usa: "যুক্তরাষ্ট্র",
  "united states": "যুক্তরাষ্ট্র",
  america: "যুক্তরাষ্ট্র",
  australia: "অস্ট্রেলিয়া",
  jordan: "জর্ডান",
  iraq: "ইরাক",
  brunei: "ব্রুনাই",
  maldives: "মালদ্বীপ",
  "united kingdom": "যুক্তরাজ্য",
  uk: "যুক্তরাজ্য",
};

function normalizeLookupKey(value: string) {
  return value.toLowerCase().trim().replace(/[.,()[\]{}]/g, "").replace(MULTI_SPACE_RE, " ");
}

function localizeKnownBanglaValue(value: string): string | null {
  return KNOWN_BANGLA_VALUES[normalizeLookupKey(value)] ?? null;
}

export function normalizeSpeechText(text: string | null | undefined, locale: Locale): string | null {
  if (!text) {
    return null;
  }

  const cleaned = text
    .replace(URL_RE, " ")
    .replace(/[_*`#~]+/g, " ")
    .replace(/[•●▪◦·]+/g, locale === "bn" ? "। " : ". ")
    .replace(/\s*\|\s*/g, locale === "bn" ? "। " : ". ")
    .replace(/\s*;\s*/g, locale === "bn" ? "। " : ". ")
    .replace(/\s*&\s*/g, locale === "bn" ? " এবং " : " and ")
    .replace(/\s*\/\s*/g, ", ")
    .replace(/\s*:\s*/g, ", ")
    .replace(/%/g, locale === "bn" ? " শতাংশ" : " percent")
    .replace(/\bBDT\b/gi, locale === "bn" ? " টাকা" : " BDT")
    .replace(/\bTk\b/gi, locale === "bn" ? " টাকা" : " Tk")
    .replace(/\bUSD\b/gi, locale === "bn" ? " মার্কিন ডলার" : " USD")
    .replace(/\bSAR\b/gi, locale === "bn" ? " সৌদি রিয়াল" : " SAR")
    .replace(/\bAED\b/gi, locale === "bn" ? " দিরহাম" : " AED")
    .replace(/\bMYR\b/gi, locale === "bn" ? " রিঙ্গিত" : " MYR")
    .replace(/\bCAD\b/gi, locale === "bn" ? " কানাডিয়ান ডলার" : " CAD")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?।])/g, "$1")
    .replace(/([,.!?।]){2,}/g, "$1")
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

function isBanglaText(text: string) {
  return BANGLA_CHAR_RE.test(text);
}

function pickBanglaVoiceCandidate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeSpeechText(value, "bn");
  if (!normalized) {
    return null;
  }
  if (isBanglaText(normalized)) {
    return normalized;
  }

  const localized = localizeKnownBanglaValue(normalized);
  if (!localized) {
    return null;
  }

  return normalizeSpeechText(localized, "bn");
}

export function getVoiceField<T extends object, K extends string>(
  record: T | null | undefined,
  base: K,
  locale: Locale,
): string | null {
  if (!record) {
    return null;
  }

  const bnKey = `${base}_bn` as keyof T;
  const enKey = `${base}_en` as keyof T;
  const baseKey = base as unknown as keyof T;

  if (locale === "bn") {
    for (const value of [record[bnKey], record[baseKey], record[enKey]]) {
      const candidate = pickBanglaVoiceCandidate(value);
      if (candidate) {
        return candidate;
      }
    }
    return null;
  }

  for (const value of [record[enKey], record[baseKey], record[bnKey]]) {
    if (typeof value !== "string") {
      continue;
    }
    const candidate = normalizeSpeechText(value, "en");
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

export function getVoiceList<T extends object, K extends string>(
  record: T | null | undefined,
  base: K,
  locale: Locale,
): string[] {
  if (!record) {
    return [];
  }

  const bnKey = `${base}_bn` as keyof T;
  const enKey = `${base}_en` as keyof T;
  const baseKey = base as unknown as keyof T;
  const sources = locale === "bn"
    ? [record[bnKey], record[baseKey], record[enKey]]
    : [record[enKey], record[baseKey], record[bnKey]];

  for (const source of sources) {
    if (!Array.isArray(source) || source.length === 0) {
      continue;
    }

    const items = source
      .map((item) => (
        locale === "bn"
          ? pickBanglaVoiceCandidate(item)
          : typeof item === "string"
            ? normalizeSpeechText(item, "en")
            : null
      ))
      .filter((item): item is string => Boolean(item));

    if (items.length > 0) {
      return items;
    }
  }

  return [];
}

export function joinVoiceParts(parts: Array<string | null | undefined>, locale: Locale): string | null {
  const cleaned = parts
    .map((part) => normalizeSpeechText(part ?? null, locale))
    .filter((part): part is string => Boolean(part));

  if (cleaned.length === 0) {
    return null;
  }

  const separator = locale === "bn" ? "। " : ". ";
  const joined = cleaned.join(separator).trim();
  if (!joined) {
    return null;
  }

  if (locale === "bn") {
    return /[।!?]$/u.test(joined) ? joined : `${joined}।`;
  }

  return /[.!?]$/.test(joined) ? joined : `${joined}.`;
}

export function buildNarratedVoiceText(
  label: string,
  content: string | string[] | null | undefined,
  locale: Locale,
): string | null {
  const body = Array.isArray(content) ? joinVoiceParts(content, locale) : normalizeSpeechText(content, locale);
  if (!body) {
    return null;
  }

  return joinVoiceParts([locale === "bn" ? `${label}, ${body}` : `${label}: ${body}`], locale);
}

export function formatVoiceDate(value: string | null | undefined, locale: Locale): string | null {
  if (!value) {
    return null;
  }

  const formatted = formatDate(value, locale);
  return normalizeSpeechText(formatted, locale);
}
