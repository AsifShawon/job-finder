"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object" || !("detail" in payload)) {
    return fallback;
  }

  const detail = payload.detail;
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (!item || typeof item !== "object" || !("msg" in item) || typeof item.msg !== "string") {
          return null;
        }
        return item.msg;
      })
      .filter(Boolean)
      .join(" ");
  }

  return fallback;
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("auth");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName.trim(), email: email.trim(), password }),
      });
      if (!res.ok) {
        let payload: unknown = null;
        try {
          payload = await res.json();
        } catch {
          payload = null;
        }
        setMessage(getErrorMessage(payload, t("registerFailed")));
        return;
      }
      const next = searchParams.get("next");
      const target = next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding";
      router.push(target as Route);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">{t("fullName")}</label>
        <Input placeholder={t("fullNamePlaceholder")} value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{t("email")}</label>
        <Input placeholder="you@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{t("password")}</label>
        <Input placeholder={t("passwordMinPlaceholder")} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button className="w-full" onClick={submit} disabled={!fullName.trim() || !email.trim() || !password || submitting}>
        {submitting ? t("registerSubmitting") : t("registerButton")}
      </Button>
      {message && <p className="text-sm text-rose-600">{message}</p>}
    </div>
  );
}
