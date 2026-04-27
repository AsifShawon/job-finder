"use client";

import { useState } from "react";
import { useLocale } from "next-intl";

import { OpportunityCard } from "@/components/opportunity-card";
import { Card } from "@/components/ui/card";
import type { OpportunityCard as Opportunity } from "@/lib/types";

export function SavedClient({ initialItems }: { initialItems: Opportunity[] }) {
  const locale = useLocale();
  const isEn = locale === "en";
  const [items, setItems] = useState<Opportunity[]>(initialItems);

  if (items.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {isEn
            ? "No opportunities have been saved yet. Save items from search or detail pages to build your list."
            : "এখনো কোনো সুযোগ সংরক্ষণ করা হয়নি। অনুসন্ধান বা বিস্তারিত পেজ থেকে সংরক্ষণ করে তালিকা তৈরি করুন।"}
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
