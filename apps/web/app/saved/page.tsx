import { Bookmark } from "lucide-react";

import { SavedClient } from "@/app/saved/saved-client";
import { getLocale } from "@/lib/i18n";
import { fetchBackendJsonWithAuth, requireCurrentUser } from "@/lib/server-auth-fetch";
import type { OpportunityCard } from "@/lib/types";

export default async function SavedPage() {
  await requireCurrentUser();
  const locale = await getLocale();
  const isEn = locale === "en";
  const savedItems = (await fetchBackendJsonWithAuth<OpportunityCard[]>("/api/v1/saved")) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Bookmark className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                {isEn ? "Shortlist" : "সংক্ষিপ্ত তালিকা"}
              </p>
              <h1 className="text-xl font-bold text-foreground">
                {isEn ? "Saved Opportunities" : "সংরক্ষিত সুযোগ"}
              </h1>
            </div>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {isEn
              ? "Keep your preferred opportunities here. Compare deadlines, source trust, and application links before applying."
              : "আপনার পছন্দের সুযোগগুলো এখানে সংরক্ষণ করুন। আবেদনের আগে শেষ তারিখ, বিশ্বাসযোগ্যতা ও লিংক মিলিয়ে নিন।"}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <SavedClient initialItems={savedItems} />
      </div>
    </div>
  );
}
