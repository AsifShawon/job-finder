"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Calendar,
  Clock,
  MapPin,
  Bookmark,
  BookmarkCheck,
  Shield,
  ShieldCheck,
  Banknote,
  ExternalLink,
  FileText,
  Globe,
  Lock,
} from "lucide-react";

import type { OpportunityCard as OpportunityCardType, RecommendationCard } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

type AnyCard = OpportunityCardType | RecommendationCard;

function daysUntil(deadline: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(deadline + "T00:00:00Z");
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

function RecordTypePill({ type }: { type: string | null | undefined }) {
  const labels: Record<string, string> = {
    overseas_job: "প্রবাস চাকরি",
    local_job: "স্থানীয় চাকরি",
    scholarship: "স্কলারশিপ",
    training: "প্রশিক্ষণ",
    migration_policy: "ভিসা নীতি",
    visa_update: "ভিসা আপডেট",
    circular: "সার্কুলার",
    warning: "সতর্কতা",
    news: "সংবাদ",
    // legacy backward compat
    job: "প্রবাস চাকরি",
    policy_update: "ভিসা নীতি",
  };
  if (!type) return null;
  return (
    <span className="text-xs font-semibold text-primary">
      {labels[type] ?? type}
    </span>
  );
}

function TrustBadge({ badge }: { badge: string | null | undefined }) {
  if (!badge) return null;
  const isGov = badge === "সরকারি উৎস";
  const isPartner = badge === "অফিসিয়াল পার্টনার";

  if (isGov) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-green-600/30 bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:border-green-700/30 dark:bg-green-900/20 dark:text-green-400">
        <ShieldCheck className="h-3 w-3" />
        {badge}
      </span>
    );
  }
  if (isPartner) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-600/30 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:border-blue-700/30 dark:bg-blue-900/20 dark:text-blue-400">
        <Shield className="h-3 w-3" />
        {badge}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700/30 dark:bg-slate-800/20 dark:text-slate-400">
      {badge}
    </span>
  );
}

function DeadlineChip({ deadline }: { deadline: string | null | undefined }) {
  if (!deadline) return null;
  const days = Math.ceil((new Date(deadline + "T00:00:00Z").getTime() - Date.now()) / 86400000);
  if (days < 0) return <span className="text-xs text-muted-foreground line-through">মেয়াদ শেষ</span>;
  if (days <= 7) return <span className="text-xs font-bold text-red-600 dark:text-red-400">⏰ {days} দিন বাকি</span>;
  if (days <= 30) return <span className="text-xs text-amber-600 dark:text-amber-400">{days} দিন বাকি</span>;
  return <span className="text-xs text-muted-foreground">আবেদনের শেষ: {new Date(deadline).toLocaleDateString("bn-BD")}</span>;
}

function EligibilityBadges({ item }: { item: AnyCard }) {
  const badges: React.ReactNode[] = [];

  if ("can_apply_from_bd" in item && item.can_apply_from_bd === true) {
    badges.push(
      <span key="bd" className="inline-flex items-center gap-0.5 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:border-green-700/30 dark:bg-green-900/20 dark:text-green-400">
        বাংলাদেশ থেকে আবেদনযোগ্য
      </span>
    );
  }
  if ("open_to_international_candidates" in item && item.open_to_international_candidates === true) {
    badges.push(
      <span key="intl" className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:border-blue-700/30 dark:bg-blue-900/20 dark:text-blue-400">
        <Globe className="h-2.5 w-2.5" />
        International
      </span>
    );
  }
  if ("lmia_status" in item && item.lmia_status && item.lmia_status !== "none") {
    badges.push(
      <span key="lmia" className="inline-flex items-center gap-0.5 rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:border-purple-700/30 dark:bg-purple-900/20 dark:text-purple-400">
        LMIA {item.lmia_status}
      </span>
    );
  }
  if ("requires_existing_work_permit" in item && item.requires_existing_work_permit === true) {
    badges.push(
      <span key="wp" className="inline-flex items-center gap-0.5 rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:border-orange-700/30 dark:bg-orange-900/20 dark:text-orange-400">
        <Lock className="h-2.5 w-2.5" />
        ওয়ার্ক পারমিট দরকার
      </span>
    );
  }

  if (badges.length === 0) return null;
  return <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div>;
}

function MatchBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        pct >= 75
          ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
          : pct >= 50
          ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
          : "bg-muted text-muted-foreground"
      )}
    >
      {pct}% মিল
    </span>
  );
}

export function OpportunityCard({
  item,
  onSavedChange,
  variant = "default",
}: {
  item: AnyCard;
  onSavedChange?: (saved: boolean) => void;
  variant?: "default" | "compact";
}) {
  const locale = useLocale() as "bn" | "en";
  const t = useTranslations("opportunity");
  const [saved, setSaved] = useState(item.is_saved);
  const [saving, setSaving] = useState(false);

  const matchScore = "match_score" in item ? item.match_score : null;

  const toggleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/saved/${item.id}`, {
        method: saved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return;
      setSaved((prev) => {
        const next = !prev;
        onSavedChange?.(next);
        return next;
      });
    } finally {
      setSaving(false);
    }
  };

  const deadlineDays = item.deadline ? daysUntil(item.deadline) : null;

  const orgName = item.employer_or_organization;
  const location = [item.destination_country, item.country].filter(Boolean).join(", ");
  const hasSalary = item.salary_min != null || item.salary_text;

  if (variant === "compact") {
    return (
      <Link
        href={`/opportunity/${item.id}`}
        className="group flex items-start gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary hover:shadow-card-hover transition-all"
      >
        <div className="flex-1 min-w-0">
          <RecordTypePill type={item.opportunity_type} />
          <p className="mt-0.5 text-sm font-semibold line-clamp-2 text-foreground group-hover:text-primary transition-colors">
            {item.title}
          </p>
          {item.country && (
            <p className="mt-1 text-xs text-muted-foreground">{item.country}</p>
          )}
        </div>
        {deadlineDays !== null && deadlineDays >= 0 && (
          <span className="shrink-0">
            <DeadlineChip deadline={item.deadline} />
          </span>
        )}
      </Link>
    );
  }

  return (
    <article className="group rounded-lg border border-border bg-card shadow-card hover:shadow-card-hover hover:border-primary/30 transition-all">
      <div className="p-5">
        {/* Top: type / trust / match / PDF */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <RecordTypePill type={item.opportunity_type} />
          {item.source_trust_badge && <span className="text-muted-foreground text-xs">·</span>}
          <TrustBadge badge={item.source_trust_badge} />
          {matchScore != null && <MatchBadge score={matchScore} />}
          {item.document_url && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/20 dark:text-red-400">
              <FileText className="h-3 w-3" />
              PDF
            </span>
          )}
        </div>

        {/* Title + org + save */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <Link
              href={`/opportunity/${item.id}`}
              className="text-base font-bold leading-snug text-foreground hover:text-primary transition-colors line-clamp-2"
            >
              {item.title}
            </Link>
            {orgName && (
              <p className="mt-0.5 text-sm text-muted-foreground">{orgName}</p>
            )}
          </div>
          <button
            onClick={toggleSave}
            disabled={saving}
            aria-label={saved ? "সংরক্ষণ বাতিল করুন" : "সংরক্ষণ করুন"}
            className="mt-0.5 shrink-0 text-muted-foreground/50 hover:text-primary transition-colors disabled:opacity-40"
          >
            {saved ? (
              <BookmarkCheck className="h-5 w-5 text-primary" />
            ) : (
              <Bookmark className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Summary */}
        {item.summary && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {item.summary}
          </p>
        )}

        {/* Eligibility badges */}
        <EligibilityBadges item={item} />

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {location}
            </span>
          )}
          {item.deadline && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <DeadlineChip deadline={item.deadline} />
            </span>
          )}
          {hasSalary && (
            <span className="flex items-center gap-1">
              <Banknote className="h-3.5 w-3.5 shrink-0" />
              {item.salary_min
                ? `${item.salary_min}${item.salary_max ? `–${item.salary_max}` : ""} ${item.salary_currency ?? ""}`
                : item.salary_text}
            </span>
          )}
          {item.published_at && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {formatDateTime(item.published_at, locale)}
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
        <Link
          href={`/opportunity/${item.id}`}
          className="text-sm font-semibold text-primary hover:underline"
        >
          বিস্তারিত দেখুন →
        </Link>
        <div className="flex items-center gap-2">
          {item.document_url && (
            <a
              href={item.document_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <FileText className="h-3.5 w-3.5" />
              মূল সার্কুলার
            </a>
          )}
          {item.original_apply_url && (
            <a
              href={item.original_apply_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              আবেদন করুন
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
