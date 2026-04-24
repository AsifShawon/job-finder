"use client";

export default function OpportunityError({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm">
      <p>Unable to load this opportunity.</p>
      <button onClick={reset} className="rounded-lg bg-red-600 px-3 py-1 text-white">Retry</button>
    </div>
  );
}
