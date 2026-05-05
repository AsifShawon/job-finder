"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { API_BASE } from "@/lib/api-base";
import { getISCSectorSearchParam, ISC_SECTORS } from "@/lib/isc-sectors";
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
  href: string;
  kind: SuggestionKind;
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function buildSearchHref(query: string) {
  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  }
  return `/search${params.toString() ? `?${params.toString()}` : ""}`;
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
    const startsWith = (value: string) => normalizeText(value).includes(normalized);

    const list: Suggestion[] = [
      {
        key: `query-${trimmed}`,
        label: `${queryLabel} “${trimmed}”`,
        href: buildSearchHref(trimmed),
        kind: "query",
      },
    ];

    COUNTRY_SUGGESTIONS.forEach((country) => {
      const label = isEn ? country.en : country.bn;
      if (startsWith(country.en) || startsWith(country.bn)) {
        list.push({
          key: `country-${country.en}`,
          label,
          sublabel: isEn ? "Country" : "দেশ",
          href: `/search?country=${encodeURIComponent(country.en)}`,
          kind: "country",
        });
      }
    });

    ISC_SECTORS.forEach((sector) => {
      if (startsWith(sector.en) || startsWith(sector.bn)) {
        list.push({
          key: `sector-${sector.key}`,
          label: isEn ? sector.en : sector.bn,
          sublabel: isEn ? "Category" : "ক্যাটাগরি",
          href: `/search?sector=${encodeURIComponent(getISCSectorSearchParam(sector.key))}`,
          kind: "sector",
        });
      }
    });

    TYPE_SUGGESTIONS.forEach((option) => {
      const label = isEn ? option.en : option.bn;
      if (startsWith(option.en) || startsWith(option.bn)) {
        list.push({
          key: `type-${option.value}`,
          label,
          sublabel: isEn ? "Type" : "ধরন",
          href: `/search?opportunity_type=${option.value}`,
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
        const response = await fetch(`${API_BASE}/api/v1/opportunities/search?${params.toString()}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          return;
        }
        const data = await response.json() as { items?: Array<{ id: number; title: string; title_bn?: string | null; country?: string | null; destination_country?: string | null; opportunity_type?: string | null; }> };
        if (cancelled) {
          return;
        }

        const results = (data.items ?? []).map((item) => {
          const title = isEn ? item.title : item.title_bn || item.title;
          const location = item.destination_country || item.country || "";
          return {
            key: `result-${item.id}`,
            label: title,
            sublabel: location ? location : (isEn ? "Opportunity" : "সুযোগ"),
            href: `/opportunity/${item.id}`,
            kind: "result" as const,
          };
        });

        const merged = [...results, ...staticSuggestions].reduce<Suggestion[]>((acc, current) => {
          if (!acc.find((item) => item.key === current.key)) {
            acc.push(current);
          }
          return acc;
        }, []);

        setSuggestions(merged.slice(0, MAX_SUGGESTIONS));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

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
    if (trimmed.length === 0) {
      router.push("/search");
      return;
    }
    router.push(buildSearchHref(trimmed));
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
    <div ref={containerRef} className="relative flex flex-1">
      <form action="/search" onSubmit={handleSubmit} className="flex w-full">
        <label className="flex w-full items-center gap-2 rounded-full border border-border bg-background px-4 py-3 text-sm transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => {
              if (query.trim().length >= MIN_QUERY_LENGTH) {
                setOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/80"
            autoComplete="off"
            aria-label={isEn ? "Search opportunities" : "সুযোগ খুঁজুন"}
            aria-expanded={open}
            aria-controls="search-suggestion-list"
            role="combobox"
          />
        </label>
      </form>

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-2xl border border-border bg-card p-2 shadow-xl">
          <div className="mb-2 flex items-center justify-between px-2 text-xs font-semibold text-muted-foreground">
            <span>{isEn ? "Suggestions" : "সাজেশন"}</span>
            {loading && <span>{isEn ? "Searching..." : "খুঁজছে..."}</span>}
          </div>
          <ul id="search-suggestion-list" role="listbox" className="grid gap-1">
            {suggestions.map((suggestion, index) => (
              <li key={suggestion.key} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(suggestion)}
                  className={cn(
                    "w-full rounded-xl px-3 py-2 text-left text-sm transition-colors",
                    index === activeIndex
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">
                      {suggestion.label}
                    </span>
                    {suggestion.sublabel && (
                      <span className="text-xs text-muted-foreground">
                        {suggestion.sublabel}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
