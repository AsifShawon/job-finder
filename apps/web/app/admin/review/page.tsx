import { AdminReviewTable } from "@/components/admin-review-table";
import { fetchBackendJsonWithAuth } from "@/lib/server-auth-fetch";
import type { FailedExtractionPage } from "@/lib/types";

export default async function AdminReviewPage() {
  const data =
    (await fetchBackendJsonWithAuth<FailedExtractionPage>("/api/v1/admin/failed-extractions")) ??
    { items: [], total: 0, page: 1, page_size: 20 };
  return AdminReviewTable({ items: data.items ?? [] });
}
