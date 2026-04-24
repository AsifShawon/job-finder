import { Card } from "@/components/ui/card";
import { formatDateTime, humanizeSlug } from "@/lib/utils";

interface FailedExtractionItem {
  id: number;
  title: string;
  record_type: string;
  source_name: string | null;
  extraction_confidence: number;
  source_url: string;
  updated_at: string;
}

export function AdminReviewTable({ items }: { items: FailedExtractionItem[] }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Review queue</p>
        <h1 className="font-display text-3xl font-bold">Failed extractions</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Review low-confidence records to identify parser issues, source markup changes, or extraction prompt drift.
        </p>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="py-2">ID</th>
                <th>Title</th>
                <th>Source</th>
                <th>Type</th>
                <th>Confidence</th>
                <th>Updated</th>
                <th>Source URL</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td className="py-3" colSpan={7}>
                    No failed extraction records or unauthorized.
                  </td>
                </tr>
              ) : (
                items.map((x) => (
                  <tr key={x.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2">{x.id}</td>
                    <td>{x.title}</td>
                    <td>{x.source_name ?? "Unknown source"}</td>
                    <td>{humanizeSlug(x.record_type)}</td>
                    <td>{Number(x.extraction_confidence).toFixed(2)}</td>
                    <td>{formatDateTime(x.updated_at)}</td>
                    <td className="max-w-[220px] truncate">{x.source_url}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
