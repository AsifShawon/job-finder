import { FileText } from "lucide-react";

import { Card } from "@/components/ui/card";
import { fetchBackendJsonWithAuth } from "@/lib/server-auth-fetch";
import { getLocale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/utils";
import type { RawDocumentPage } from "@/lib/types";

export default async function AdminRawItemsPage() {
  const [locale, data] = await Promise.all([
    getLocale(),
    fetchBackendJsonWithAuth<RawDocumentPage>("/api/v1/admin/raw-documents?page_size=50"),
  ]);
  const isEn = locale === "en";
  const page = data ?? { items: [], total: 0, page: 1, page_size: 50 };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {isEn ? "Audit Trail" : "অডিট ট্রেইল"}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">
          {isEn ? "Raw Crawl Items" : "মূল ক্রল আইটেম"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEn
            ? "Inspect raw crawled records, snapshots, content hashes, item types, and skip reasons. Records are not deleted from this view."
            : "মূল ক্রল রেকর্ড, স্ন্যাপশট, কনটেন্ট হ্যাশ, আইটেম টাইপ ও স্কিপ কারণ দেখুন। এই ভিউ থেকে রেকর্ড মুছে ফেলা যায় না।"}
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {["ID", isEn ? "Title" : "শিরোনাম", "URL", isEn ? "Type" : "ধরন", isEn ? "Skip reason" : "স্কিপ কারণ", isEn ? "Fetched" : "ক্রল সময়"].map((header) => (
                  <th key={header} className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {page.items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">#{item.id}</td>
                  <td className="px-3 py-3 max-w-[220px]">
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="font-medium line-clamp-2">{item.raw_title ?? "Untitled"}</span>
                    </div>
                    {item.source_job_id && <p className="mt-1 text-xs text-muted-foreground">Job ID: {item.source_job_id}</p>}
                  </td>
                  <td className="px-3 py-3 max-w-[280px]">
                    <a href={item.source_url} target="_blank" rel="noreferrer" className="break-all text-xs text-primary hover:underline">
                      {item.source_url}
                    </a>
                  </td>
                  <td className="px-3 py-3 text-xs">{item.detected_item_type ?? item.content_type ?? "unknown"}</td>
                  <td className="px-3 py-3 max-w-[220px] text-xs text-amber-700">{item.skip_reason ?? "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(item.fetched_at, locale)}</td>
                </tr>
              ))}
              {page.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {isEn ? "No raw crawl items found." : "কোনো মূল ক্রল আইটেম নেই।"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
