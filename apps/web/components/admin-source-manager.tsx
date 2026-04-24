"use client";

import { Edit3, Play, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AdminSource } from "@/lib/types";
import { formatDateTime, humanizeSlug } from "@/lib/utils";

async function getResponseMessage(response: Response, fallback: string): Promise<string> {
  const text = await response.text();
  if (!text) {
    return fallback;
  }
  try {
    const data = JSON.parse(text) as { detail?: unknown; message?: unknown };
    if (typeof data.detail === "string") {
      return data.detail;
    }
    if (typeof data.message === "string") {
      return data.message;
    }
  } catch {
    return text;
  }
  return fallback;
}

interface SourceFormState {
  name: string;
  base_url: string;
}

const defaultFormState: SourceFormState = {
  name: "",
  base_url: "",
};

function formStateFromSource(source: AdminSource): SourceFormState {
  return {
    name: source.name,
    base_url: source.base_url,
  };
}

export function AdminSourceManager({ initialSources }: { initialSources: AdminSource[] }) {
  const [sources, setSources] = useState(initialSources);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SourceFormState>(defaultFormState);
  const [statusMessage, setStatusMessage] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const refreshSources = async () => {
    const response = await fetch("/api/admin/sources", { cache: "no-store" });
    if (!response.ok) {
      setStatusMessage("Could not refresh source registry.");
      return;
    }
    const data = (await response.json()) as AdminSource[];
    setSources(data);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(defaultFormState);
  };

  const updateField = <K extends keyof SourceFormState>(key: K, value: SourceFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    setBusyKey("form");
    setStatusMessage("");
    try {
      const payload = {
        ...form,
        country: "Bangladesh",
        source_class: "news_policy",
        trust_tier: "news_only",
        access_method: "static_html",
        crawl_frequency_minutes: 1440,
        is_active: true,
        parser_key: "default",
      };

      const response = await fetch(editingId ? `/api/admin/sources/${editingId}` : "/api/admin/sources", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setStatusMessage(await getResponseMessage(response, "Could not save source."));
        return;
      }

      await refreshSources();
      resetForm();
      setStatusMessage(editingId ? "Source updated." : "Source created.");
    } finally {
      setBusyKey(null);
    }
  };

  const startEdit = (source: AdminSource) => {
    setEditingId(source.id);
    setForm(formStateFromSource(source));
    setStatusMessage("");
  };

  const triggerCrawl = async (sourceId: number) => {
    setBusyKey(`crawl-${sourceId}`);
    setStatusMessage("");
    try {
      const response = await fetch("/api/admin/source-crawls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId }),
      });
      if (!response.ok) {
        setStatusMessage(await getResponseMessage(response, "Could not queue crawl."));
        await refreshSources();
        return;
      }
      setStatusMessage(await getResponseMessage(response, `Crawl queued for source ${sourceId}.`));
      await refreshSources();
    } finally {
      setBusyKey(null);
    }
  };

  const deleteSource = async (sourceId: number) => {
    setBusyKey(`delete-${sourceId}`);
    setStatusMessage("");
    try {
      const response = await fetch(`/api/admin/sources/${sourceId}`, { method: "DELETE" });
      if (!response.ok) {
        setStatusMessage("Could not delete source.");
        return;
      }
      if (editingId === sourceId) {
        resetForm();
      }
      setStatusMessage(`Source ${sourceId} deleted.`);
      await refreshSources();
    } finally {
      setBusyKey(null);
    }
  };

  const activeCount = sources.filter((source) => source.is_active).length;
  const runningCount = sources.filter((source) => source.last_crawl_status === "running").length;
  const totalOpportunities = sources.reduce((sum, source) => sum + source.opportunity_count, 0);
  const totalRawDocuments = sources.reduce((sum, source) => sum + source.raw_document_count, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Sources", String(sources.length), `${activeCount} active`],
          ["Running crawls", String(runningCount), "currently queued or fetching"],
          ["Opportunities", String(totalOpportunities), "indexed records"],
          ["Raw documents", String(totalRawDocuments), "stored source snapshots"],
        ].map(([label, value, hint]) => (
          <Card key={label} className="rounded-lg p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
            <p className="mt-1 font-display text-3xl font-bold">{value}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">{hint}</p>
          </Card>
        ))}
      </div>

      <Card className="rounded-lg p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {editingId ? "Edit source" : "Create source"}
            </p>
            <h2 className="font-display text-2xl font-bold">
              {editingId ? `Update source #${editingId}` : "Register a source"}
            </h2>
            <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              Add a newspaper or paper main link. Crawls will discover recent Bangladesh job and migration policy pages from that source.
            </p>
          </div>
          {statusMessage && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
              {statusMessage}
            </p>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-12">
          <label className="space-y-1 lg:col-span-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Title</span>
            <Input placeholder="Gulf News" value={form.name} onChange={(event) => updateField("name", event.target.value)} />
          </label>
          <label className="space-y-1 lg:col-span-8">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Main URL</span>
            <Input placeholder="https://gulfnews.com/" value={form.base_url} onChange={(event) => updateField("base_url", event.target.value)} />
          </label>

          <div className="flex flex-wrap items-end gap-3 lg:col-span-12">
            <Button onClick={submit} disabled={busyKey === "form" || !form.name || !form.base_url}>
              {busyKey === "form" ? (
                <>
                  <RotateCcw className="mr-2 size-4 animate-spin" />
                  Saving
                </>
              ) : editingId ? (
                <>
                  <Save className="mr-2 size-4" />
                  Update source
                </>
              ) : (
                <>
                  <Plus className="mr-2 size-4" />
                  Create source
                </>
              )}
            </Button>
            {editingId ? (
              <Button variant="outline" onClick={resetForm}>
                <X className="mr-2 size-4" />
                Cancel edit
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Registry</p>
            <h2 className="font-display text-2xl font-bold">Source health and controls</h2>
          </div>
          <Button variant="outline" onClick={refreshSources}>
            <RotateCcw className="mr-2 size-4" />
            Refresh
          </Button>
        </div>
        {sources.length === 0 ? (
          <Card className="rounded-lg">
            <p className="text-sm text-slate-600 dark:text-slate-300">No sources registered yet.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {sources.map((source) => (
              <article
                key={source.id}
                className="rounded-lg border border-slate-200 bg-white/85 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/85"
              >
                <div className="grid gap-4 xl:grid-cols-[minmax(280px,1.4fr)_1fr_auto]">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">{source.name}</h3>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                          source.is_active
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {source.is_active ? "Active" : "Paused"}
                      </span>
                      {source.last_crawl_status ? (
                        <span className="rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700">
                          {humanizeSlug(source.last_crawl_status)}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-sm text-slate-600 dark:text-slate-300">{source.base_url}</p>
                    <p className="text-xs text-slate-500">
                      Searches recent Bangladesh job and migration policy links on this source.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <p>
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Country</span>
                      {source.country ?? "Bangladesh"}
                    </p>
                    <p>
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Mode</span>
                      Discover links
                    </p>
                    <p className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Records</span>
                      {source.opportunity_count}
                    </p>
                    <p className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Active</span>
                      {source.active_opportunity_count}
                    </p>
                    <p className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Raw docs</span>
                      {source.raw_document_count}
                    </p>
                    <p className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Extracted</span>
                      {source.last_records_extracted}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-start justify-end gap-2">
                    <Button variant="outline" onClick={() => startEdit(source)}>
                      <Edit3 className="mr-2 size-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => triggerCrawl(source.id)}
                      disabled={busyKey === `crawl-${source.id}`}
                    >
                      <Play className="mr-2 size-4" />
                      {busyKey === `crawl-${source.id}` ? "Queuing" : "Crawl"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => deleteSource(source.id)}
                      disabled={busyKey === `delete-${source.id}`}
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10"
                    >
                      <Trash2 className="mr-2 size-4" />
                      {busyKey === `delete-${source.id}` ? "Deleting" : "Delete"}
                    </Button>
                  </div>
                </div>
                <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
                  Last crawl started {formatDateTime(source.last_crawl_started_at)} and finished {formatDateTime(source.last_crawl_finished_at)}.
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
