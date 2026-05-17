"use client";

import type { Route } from "next";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { API_BASE } from "@/lib/api-base";
import { buildAllJobsHref, buildISCCategoryHref, ISC_SECTORS } from "@/lib/isc-sectors";
import { cn } from "@/lib/utils";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 350;
const MAX_SUGGESTIONS = 8;

const COUNTRY_SUGGESTIONS = [
  { en: "Malaysia", bn: "মালয়েশিয়া" },
  { en: "Saudi Arabia", bn: "সৌদি আরব" },
  { en: "Qatar", bn: "কাতার" },
  { en: "United Arab Emirates", bn: "সংযুক্ত আরব আমিরাত" },
  { en: "Kuwait", bn: "কুয়েত" },
  { en: "Bahrain", bn: "বাহরাইন" },
  { en: "Oman", bn: "ওমান" },
  { en: "Singapore", bn: "সিঙ্গাপুর" },
  { en: "South Korea", bn: "দক্ষিণ কোরিয়া" },
  { en: "Japan", bn: "জাপান" },
  { en: "Italy", bn: "ইতালি" },
  { en: "United Kingdom", bn: "যুক্তরাজ্য" },
  { en: "Canada", bn: "কানাডা" },
  { en: "Australia", bn: "অস্ট্রেলিয়া" },
  { en: "Germany", bn: "জার্মানি" },
];

const TYPE_SUGGESTIONS = [
  { value: "overseas_job,local_job", bn: "সব চাকরি", en: "All jobs" },
  { value: "overseas_job", bn: "প্রবাস চাকরি", en: "Overseas jobs" },
  { value: "local_job", bn: "স্থানীয় চাকরি", en: "Local jobs" },
  { value: "scholarship", bn: "স্কলারশিপ", en: "Scholarships" },
  { value: "training", bn: "প্রশিক্ষণ", en: "Training" },
  { value: "migration_policy", bn: "ভিসা নীতি", en: "Visa policy" },
] as const;

type SuggestionKind = "query" | "country" | "sector" | "type" | "result";

type Suggestion = {
  key: string;
  label: string;
  sublabel?: string;
  href: Route;
  kind: SuggestionKind;
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function buildSearchHref(query: string): Route {
  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  }
  return `/search${params.toString() ? `?${params.toString()}` : ""}` as Route;
}

export function SearchAutocomplete({ isEn }: { isEn: boolean }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const placeholder = isEn
    ? "Search jobs, scholarships, countries, or visa updates"
    : "চাকরি, স্কলারশিপ, দেশ বা ভিসা আপডেট খুঁজুন";
  const queryLabel = isEn ? "Search for" : "খুঁজুন";

  const staticSuggestions = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      return [] as Suggestion[];
    }

    const normalized = normalizeText(trimmed);
    const matches = (value: string) => normalizeText(value).includes(normalized);

    const list: Suggestion[] = [
      {
        key: `query-${trimmed}`,
        label: `${queryLabel} "${trimmed}"`,
        href: buildSearchHref(trimmed),
        kind: "query",
      },
    ];

    COUNTRY_SUGGESTIONS.forEach((country) => {
      if (matches(country.en) || matches(country.bn)) {
        list.push({
          key: `country-${country.en}`,
          label: isEn ? country.en : country.bn,
          sublabel: isEn ? "Country" : "দেশ",
          href: `/search?country=${encodeURIComponent(country.en)}` as Route,
          kind: "country",
        });
      }
    });

    ISC_SECTORS.forEach((sector) => {
      if (matches(sector.en) || matches(sector.bn)) {
        list.push({
          key: `sector-${sector.key}`,
          label: isEn ? sector.en : sector.bn,
          sublabel: isEn ? "Category" : "ক্যাটাগরি",
          href: buildISCCategoryHref(sector.key),
          kind: "sector",
        });
      }
    });

    TYPE_SUGGESTIONS.forEach((option) => {
      if (matches(option.en) || matches(option.bn)) {
        list.push({
          key: `type-${option.value}`,
          label: isEn ? option.en : option.bn,
          sublabel: isEn ? "Type" : "ধরন",
          href: option.value === "overseas_job,local_job"
            ? buildAllJobsHref()
            : `/search?opportunity_type=${option.value}` as Route,
          kind: "type",
        });
      }
    });

    return list.slice(0, MAX_SUGGESTIONS);
  }, [isEn, query, queryLabel]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setDebouncedQuery("");
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      return undefined;
    }

    const timer = setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < MIN_QUERY_LENGTH) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setSuggestions(staticSuggestions);
      setOpen(true);
      setActiveIndex(-1);
      try {
        const params = new URLSearchParams({ q: debouncedQuery, page_size: "5" });
        const response = await fetch(`${API_BASE}/api/v1/opportunities/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          return;
        }
        const data = await response.json() as {
          items?: Array<{
            id: number;
            title: string;
            title_bn?: string | null;
            country?: string | null;
            destination_country?: string | null;
          }>;
        };
        if (cancelled) {
          return;
        }

        const results = (data.items ?? []).map((item) => ({
          key: `result-${item.id}`,
          label: isEn ? item.title : item.title_bn || item.title,
          sublabel: item.destination_country || item.country || (isEn ? "Opportunity" : "সুযোগ"),
          href: `/opportunity/${item.id}` as Route,
          kind: "result" as const,
        }));

        const merged = [...results, ...staticSuggestions].reduce<Suggestion[]>((acc, current) => {
          if (!acc.find((item) => item.key === current.key)) {
            acc.push(current);
          }
          return acc;
        }, []);

        setSuggestions(merged.slice(0, MAX_SUGGESTIONS));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        throw error;
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debouncedQuery, isEn, staticSuggestions]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const handleSelect = (suggestion: Suggestion) => {
    setOpen(false);
    setActiveIndex(-1);
    router.push(suggestion.href);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? buildSearchHref(trimmed) : "/search");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      handleSelect(suggestions[activeIndex]);
    }

    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <form
        onSubmit={handleSubmit}
        className="flex h-12 items-center gap-3 rounded-full border border-border bg-white px-4 shadow-sm"
      >
        <Search className="h-5 w-5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) {
              setOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          aria-label={placeholder}
        />
      </form>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-3xl border border-border bg-white shadow-2xl">
          <div className="max-h-[24rem] overflow-y-auto p-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.key}
                type="button"
                onClick={() => handleSelect(suggestion)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition-colors",
                  index === activeIndex ? "bg-primary/8 text-primary" : "text-foreground hover:bg-muted/60",
                )}
              >
                <Search className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{suggestion.label}</span>
                  {suggestion.sublabel ? (
                    <span className="block truncate text-xs text-muted-foreground">{suggestion.sublabel}</span>
                  ) : null}
                </span>
              </button>
            ))}

            {loading && (
              <div className="px-4 py-3 text-xs font-medium text-muted-foreground">
                {isEn ? "Loading..." : "লোড হচ্ছে..."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
