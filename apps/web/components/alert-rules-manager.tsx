"use client";

import { useState } from "react";
import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AlertRule } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

interface AlertRulesManagerProps {
  initialAlerts: AlertRule[];
}

export function AlertRulesManager({ initialAlerts }: AlertRulesManagerProps) {
  const locale = useLocale() as "bn" | "en";
  const isEn = locale === "en";
  const [alerts, setAlerts] = useState(initialAlerts);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refreshAlerts = async () => {
    const response = await fetch("/api/alerts", { cache: "no-store" });
    if (!response.ok) {
      setStatusMessage(isEn ? "Could not refresh alert rules." : "সতর্কতার নিয়ম রিফ্রেশ করা যায়নি।");
      return;
    }
    const data = (await response.json()) as { items: AlertRule[] };
    setAlerts(data.items ?? []);
  };

  const createAlert = async () => {
    setSubmitting(true);
    setStatusMessage("");
    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          query_text: query,
          filter_json: {},
          is_active: true,
        }),
      });
      if (!response.ok) {
        setStatusMessage(isEn ? "Could not create alert rule." : "সতর্কতার নিয়ম তৈরি করা যায়নি।");
        return;
      }
      setName("");
      setQuery("");
      setStatusMessage(isEn ? "Alert rule created." : "সতর্কতার নিয়ম তৈরি হয়েছে।");
      await refreshAlerts();
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAlert = async (alert: AlertRule) => {
    setPendingId(alert.id);
    setStatusMessage("");
    try {
      const response = await fetch(`/api/alerts/${alert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !alert.is_active }),
      });
      if (!response.ok) {
        setStatusMessage(isEn ? "Could not update alert rule." : "সতর্কতার নিয়ম আপডেট করা যায়নি।");
        return;
      }
      await refreshAlerts();
    } finally {
      setPendingId(null);
    }
  };

  const deleteAlert = async (alertId: number) => {
    setPendingId(alertId);
    setStatusMessage("");
    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setStatusMessage(isEn ? "Could not delete alert rule." : "সতর্কতার নিয়ম মুছতে সমস্যা হয়েছে।");
        return;
      }
      await refreshAlerts();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{isEn ? "Create Alert" : "সতর্কতা তৈরি করুন"}</p>
          <h2 className="font-display text-2xl font-bold">{isEn ? "New Alert Rule" : "নতুন সতর্কতার নিয়ম"}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {isEn
              ? "Monitor new opportunities that match a specific search phrase."
              : "নির্দিষ্ট অনুসন্ধান বাক্যের সাথে মিল থাকা নতুন সুযোগ নজরে রাখুন।"}
          </p>
        </div>
        <div className="space-y-3">
          <Input placeholder={isEn ? "Alert name" : "সতর্কতার নাম"} value={name} onChange={(event) => setName(event.target.value)} />
          <Input
            placeholder={isEn ? "Search, e.g. nursing visa jobs in Germany" : "অনুসন্ধান, যেমন জার্মানিতে নার্সিং ভিসা চাকরি"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button className="w-full" onClick={createAlert} disabled={!name || !query || submitting}>
            {submitting ? (isEn ? "Creating..." : "তৈরি হচ্ছে...") : (isEn ? "Create alert" : "সতর্কতা তৈরি করুন")}
          </Button>
          {statusMessage && <p className="text-sm text-slate-600 dark:text-slate-300">{statusMessage}</p>}
        </div>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">{isEn ? "Existing Alerts" : "বিদ্যমান সতর্কতা"}</h2>
          <p className="text-sm text-slate-500">{isEn ? `${alerts.length} rules` : `${alerts.length}টি নিয়ম`}</p>
        </div>
        {alerts.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {isEn
                ? "No alert rules yet. Create a rule to automatically catch new jobs, scholarships, or policy updates."
                : "এখনো কোনো সতর্কতার নিয়ম নেই। নতুন চাকরি, বৃত্তি বা নীতি আপডেট স্বয়ংক্রিয়ভাবে ধরতে একটি নিয়ম তৈরি করুন।"}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <Card key={alert.id} className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl font-bold">{alert.name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{alert.query_text}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                      alert.is_active
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {alert.is_active ? (isEn ? "Active" : "সক্রিয়") : (isEn ? "Paused" : "স্থগিত")}
                  </span>
                </div>
                <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2">
                  <p>{isEn ? "Last run" : "শেষ চালানো"}: {formatDateTime(alert.last_run_at, locale)}</p>
                  <p>{isEn ? "Created" : "তৈরি"}: {formatDateTime(alert.created_at, locale)}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => toggleAlert(alert)}
                    disabled={pendingId === alert.id}
                  >
                    {pendingId === alert.id
                      ? (isEn ? "Updating..." : "আপডেট হচ্ছে...")
                      : alert.is_active
                        ? (isEn ? "Pause" : "স্থগিত করুন")
                        : (isEn ? "Activate" : "সক্রিয় করুন")}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => deleteAlert(alert.id)}
                    disabled={pendingId === alert.id}
                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10"
                  >
                    {isEn ? "Delete" : "মুছুন"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
