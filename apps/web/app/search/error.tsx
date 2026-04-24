"use client";

export default function SearchError({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm">
      <p>Could not load search results right now.</p>
      <button onClick={reset} className="rounded-lg bg-red-600 px-3 py-1 text-white">Retry</button>
    </div>
  );
}
