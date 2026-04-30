"use client";

import Link from "next/link";
import type { OpportunityType } from "@/lib/types";

export interface TickerItem {
  id: number;
  title: string;
  title_bn: string | null;
  opportunity_type: OpportunityType | null;
}

const TYPE_META: Record<string, { label: string; cls: string }> = {
  overseas_job:      { label: "প্রবাস চাকরি",      cls: "border-green-400 text-green-400" },
  local_job:         { label: "স্থানীয় চাকরি",     cls: "border-teal-400 text-teal-400" },
  scholarship:       { label: "স্কলারশিপ",          cls: "border-blue-400 text-blue-400" },
  training:          { label: "দক্ষতা প্রশিক্ষণ",   cls: "border-cyan-400 text-cyan-400" },
  migration_policy:  { label: "ভিসা নীতি",          cls: "border-yellow-400 text-yellow-400" },
  visa_update:       { label: "ভিসা নীতি",          cls: "border-yellow-400 text-yellow-400" },
  circular:          { label: "সরকারি সার্কুলার",   cls: "border-purple-400 text-purple-400" },
  warning:           { label: "সতর্কতা",             cls: "border-red-400 text-red-400" },
  news:              { label: "সংবাদ",               cls: "border-slate-400 text-slate-400" },
};

const FALLBACK_META = { label: "সুযোগ", cls: "border-slate-400 text-slate-400" };

export function NewsTicker({ items }: { items: TickerItem[] }) {
  if (!items.length) return null;

  const doubled = [...items, ...items];

  return (
    <div className="overflow-hidden bg-navy text-white py-2 select-none">
      <div className="flex items-center gap-0">
        <span className="shrink-0 bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-white mr-4 ml-0">
          সর্বশেষ
        </span>

        <div className="overflow-hidden flex-1">
          <div className="flex gap-8 animate-ticker whitespace-nowrap">
            {doubled.map((item, i) => {
              const meta = TYPE_META[item.opportunity_type ?? ""] ?? FALLBACK_META;
              const label = item.title_bn || item.title;
              return (
                <Link
                  key={i}
                  href={`/opportunity/${item.id}`}
                  className="inline-flex shrink-0 items-center gap-2 text-sm hover:text-primary transition-colors"
                >
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
                    {meta.label}
                  </span>
                  <span className="text-slate-200">{label}</span>
                  <span className="text-slate-500 mx-2">◆</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
