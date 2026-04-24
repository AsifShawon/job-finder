"use client";

import { useState } from "react";

import { OpportunityCard } from "@/components/opportunity-card";
import { Card } from "@/components/ui/card";
import type { OpportunityCard as Opportunity } from "@/lib/types";

export function SavedClient({ initialItems }: { initialItems: Opportunity[] }) {
  const [items, setItems] = useState<Opportunity[]>(initialItems);

  if (items.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          No saved opportunities yet. Save items from search or detail pages to build a working shortlist.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <OpportunityCard
          key={item.id}
          item={item}
          onSavedChange={(saved) => {
            if (!saved) {
              setItems((current) => current.filter((candidate) => candidate.id !== item.id));
            }
          }}
        />
      ))}
    </div>
  );
}
