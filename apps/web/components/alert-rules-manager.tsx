"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AlertRule } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

interface AlertRulesManagerProps {
  initialAlerts: AlertRule[];
}

export function AlertRulesManager({ initialAlerts }: AlertRulesManagerProps) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refreshAlerts = async () => {
    const response = await fetch("/api/alerts", { cache: "no-store" });
    if (!response.ok) {
      setStatusMessage("Could not refresh alert rules.");
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
        setStatusMessage("Could not create alert rule.");
        return;
      }
      setName("");
      setQuery("");
      setStatusMessage("Alert rule created.");
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
        setStatusMessage("Could not update alert rule.");
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
        setStatusMessage("Could not delete alert rule.");
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Create alert</p>
          <h2 className="font-display text-2xl font-bold">New alert rule</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Track new opportunities matching a search phrase. The worker and beat services will generate alert events.
          </p>
        </div>
        <div className="space-y-3">
          <Input placeholder="Alert name" value={name} onChange={(event) => setName(event.target.value)} />
          <Input
            placeholder="Query text, e.g. nursing visa jobs in Germany"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button className="w-full" onClick={createAlert} disabled={!name || !query || submitting}>
            {submitting ? "Creating..." : "Create alert"}
          </Button>
          {statusMessage && <p className="text-sm text-slate-600 dark:text-slate-300">{statusMessage}</p>}
        </div>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">Existing alerts</h2>
          <p className="text-sm text-slate-500">{alerts.length} rules</p>
        </div>
        {alerts.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No alert rules yet. Create one to monitor new job, scholarship, or policy matches automatically.
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
                    {alert.is_active ? "Active" : "Paused"}
                  </span>
                </div>
                <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2">
                  <p>Last run: {formatDateTime(alert.last_run_at)}</p>
                  <p>Created: {formatDateTime(alert.created_at)}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => toggleAlert(alert)}
                    disabled={pendingId === alert.id}
                  >
                    {pendingId === alert.id ? "Updating..." : alert.is_active ? "Pause" : "Activate"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => deleteAlert(alert.id)}
                    disabled={pendingId === alert.id}
                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10"
                  >
                    Delete
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
