"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminAiSettings } from "@/lib/types";

export function AdminAiSettingsForm({ initialSettings }: { initialSettings: AdminAiSettings }) {
  const [model, setModel] = useState(initialSettings.groq_model);
  const [apiKey, setApiKey] = useState("");
  const [configured, setConfigured] = useState(initialSettings.groq_api_key_configured);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setMessage("");
    try {
      const payload: { groq_model: string; groq_api_key?: string } = { groq_model: model.trim() };
      if (apiKey.trim()) {
        payload.groq_api_key = apiKey.trim();
      }

      const response = await fetch("/api/admin/settings/ai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setMessage("Could not save AI settings.");
        return;
      }

      const saved = (await response.json()) as AdminAiSettings;
      setConfigured(saved.groq_api_key_configured);
      setModel(saved.groq_model);
      setApiKey("");
      setMessage("AI settings saved.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950">
        Groq API key: <span className="font-semibold">{configured ? "Configured" : "Not configured"}</span>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Groq API key</label>
        <Input
          type="password"
          placeholder={configured ? "Leave blank to keep current key" : "Paste Groq API key"}
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Groq model</label>
        <Input value={model} onChange={(event) => setModel(event.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={!model.trim() || submitting}>
          {submitting ? "Saving..." : "Save AI settings"}
        </Button>
        {message && <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>}
      </div>
    </div>
  );
}
