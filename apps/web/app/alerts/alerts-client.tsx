"use client";

import { useState } from "react";

import { AlertRulesManager } from "@/components/alert-rules-manager";
import type { AlertRule } from "@/lib/types";

export function AlertsClient({ initialAlerts }: { initialAlerts: AlertRule[] }) {
  const [alerts] = useState(initialAlerts);

  return <AlertRulesManager initialAlerts={alerts} />;
}
