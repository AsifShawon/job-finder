"use client";

import { useLocale } from "next-intl";

export default function OpportunityError({ reset }: { reset: () => void }) {
  const isEn = useLocale() === "en";
  return (
    <div className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm">
      <p>{isEn ? "This opportunity could not be loaded." : "এই সুযোগটি লোড করা যায়নি।"}</p>
      <button onClick={reset} className="rounded-lg bg-red-600 px-3 py-1 text-white">{isEn ? "Try again" : "আবার চেষ্টা করুন"}</button>
    </div>
  );
}
