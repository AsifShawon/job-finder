import { Compass } from "lucide-react";

import { AdminDiscoverForm } from "@/components/admin-discover-form";
import { getLocale } from "@/lib/i18n";

export default async function AdminDiscoverPage() {
  const locale = await getLocale();
  const isEn = locale === "en";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {isEn ? "Agentic Discovery" : "এজেন্টিক আবিষ্কার"}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isEn ? "Discover opportunities by query" : "প্রশ্নের ভিত্তিতে সুযোগ আবিষ্কার করুন"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEn
                ? "Type a free-form query like \"nursing jobs in Canada open to Bangladeshis\". The agent expands the query, searches the open web (SearXNG / DuckDuckGo), extracts opportunities, and lands them as pending drafts."
                : "যেকোনো প্রশ্ন লিখুন যেমন \"কানাডায় বাংলাদেশিদের জন্য নার্স চাকরি\"। এজেন্ট প্রশ্ন বিস্তার করে ওয়েব সার্চ করবে এবং ফলাফলগুলো pending draft হিসেবে রিভিউ কিউতে যোগ করবে।"}
            </p>
          </div>
        </div>
      </div>

      <AdminDiscoverForm isEn={isEn} />
    </div>
  );
}
