"use client";

import { useState } from "react";
import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminAiSettings } from "@/lib/types";

export function AdminAiSettingsForm({ initialSettings }: { initialSettings: AdminAiSettings }) {
  const locale = useLocale();
  const isEn = locale === "en";
  const [provider, setProvider] = useState(initialSettings.ai_provider);
  const [model, setModel] = useState(initialSettings.ai_model);
  const [apiKey, setApiKey] = useState("");
  const [configured, setConfigured] = useState(initialSettings.ai_api_key_configured);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setMessage("");
    try {
      const payload: { ai_provider: string; ai_model: string; ai_api_key?: string } = {
        ai_provider: provider,
        ai_model: model.trim(),
      };
      if (apiKey.trim()) {
        payload.ai_api_key = apiKey.trim();
      }

      const response = await fetch("/api/admin/settings/ai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setMessage(isEn ? "Could not save AI settings." : "AI সেটিংস সংরক্ষণ করা যায়নি।");
        return;
      }

      const saved = (await response.json()) as AdminAiSettings;
  setProvider(saved.ai_provider);
  setConfigured(saved.ai_api_key_configured);
  setModel(saved.ai_model);
      setApiKey("");
      setMessage(isEn ? "AI settings saved." : "AI সেটিংস সংরক্ষিত হয়েছে।");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950">
        {isEn ? "AI provider" : "AI প্রদানকারী"}: {" "}
        <span className="font-semibold uppercase">{provider}</span>{" "}
        {" • "}
        {isEn ? "API key" : "API কী"}: {" "}
        <span className="font-semibold">{configured ? (isEn ? "Configured" : "কনফিগার করা আছে") : (isEn ? "Not configured" : "কনফিগার করা নেই")}</span>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{isEn ? "AI provider" : "AI প্রদানকারী"}</label>
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="groq">Groq</option>
          <option value="mistral">Mistral</option>
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {provider === "mistral" ? (isEn ? "Mistral API key" : "Mistral API কী") : (isEn ? "Groq API key" : "Groq API কী")}
        </label>
        <Input
          type="password"
          placeholder={configured ? (isEn ? "Leave blank to keep the current key" : "বর্তমান কী রাখতে খালি রাখুন") : (provider === "mistral" ? (isEn ? "Paste Mistral API key" : "Mistral API কী পেস্ট করুন") : (isEn ? "Paste Groq API key" : "Groq API কী পেস্ট করুন"))}
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{isEn ? "Model" : "মডেল"}</label>
        <Input value={model} onChange={(event) => setModel(event.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={!model.trim() || submitting}>
          {submitting ? (isEn ? "Saving..." : "সংরক্ষণ হচ্ছে...") : (isEn ? "Save AI settings" : "AI সেটিংস সংরক্ষণ করুন")}
        </Button>
        {message && <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>}
      </div>
    </div>
  );
}
