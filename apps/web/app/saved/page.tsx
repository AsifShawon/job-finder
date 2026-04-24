import { SavedClient } from "@/app/saved/saved-client";
import { requireCurrentUser, fetchBackendJsonWithAuth } from "@/lib/server-auth-fetch";
import type { OpportunityCard } from "@/lib/types";

export default async function SavedPage() {
  await requireCurrentUser();
  const savedItems = (await fetchBackendJsonWithAuth<OpportunityCard[]>("/api/v1/saved")) ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Shortlist</p>
        <h1 className="font-display text-4xl font-bold">Saved opportunities</h1>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Keep your active shortlist here. Remove items once they are no longer relevant, and revisit detail pages to compare deadlines, trust, and application links.
        </p>
      </div>
      <SavedClient initialItems={savedItems} />
    </div>
  );
}
