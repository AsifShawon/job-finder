import { PenLine } from "lucide-react";

import { AdminManualEntryForm } from "@/components/admin-manual-entry-form";
import { getLocale } from "@/lib/i18n";

export default async function AdminManualEntryPage() {
  const locale = await getLocale();
  const isEn = locale === "en";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {isEn ? "Editorial Intake" : "ম্যানুয়াল ইনটেক"}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <PenLine className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isEn ? "Manual Job Entry" : "ম্যানুয়াল জব এন্ট্রি"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEn
                ? "Paste a full job post or upload a CSV/XLSX sheet and send everything into the same pending-review queue used by crawled opportunities."
                : "সম্পূর্ণ চাকরির বিবরণ পেস্ট করুন অথবা CSV/XLSX শিট আপলোড করুন, তারপর সবকিছু একই pending-review queue-তে পাঠান যেখানে crawl করা সুযোগগুলো যায়।"}
            </p>
          </div>
        </div>
      </div>

      <AdminManualEntryForm />
    </div>
  );
}
