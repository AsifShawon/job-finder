import { AdminCrawlInspection } from "@/components/admin-crawl-inspection";
import { getLocale } from "@/lib/i18n";
import { fetchBackendJsonWithAuth } from "@/lib/server-auth-fetch";
import type { CrawlRunInspection } from "@/lib/types";

interface InspectionPageProps {
  params: Promise<{ runId: string }>;
}

export default async function CrawlRunInspectionPage({ params }: InspectionPageProps) {
  const { runId } = await params;
  const locale = await getLocale();
  const inspection =
    (await fetchBackendJsonWithAuth<CrawlRunInspection>(`/api/v1/admin/crawl-runs/${runId}/inspection`)) ?? {
      run_id: Number(runId),
      source_id: 0,
      source_name: null,
      connector_key: null,
      crawl_status: null,
      source_url: null,
      started_at: null,
      finished_at: null,
      pages_discovered: 0,
      detail_pages_followed: 0,
      parser_success_count: 0,
      ai_success_count: 0,
      failed_count: 0,
      pending_admin_review_count: 0,
      run_logs: [],
      discovery_diagnostics: {},
      extraction_method_counts: {},
      skip_reasons: {},
      fallback_reasons: {},
      pages: [],
      opportunity_ids: [],
    };

  return <AdminCrawlInspection initialRun={inspection} locale={locale} />;
}
