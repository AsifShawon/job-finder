import { proxyWithSession } from "@/lib/proxy-auth";

export async function GET(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return proxyWithSession({
    path: `/api/v1/admin/crawl-runs/${runId}/inspection`,
    method: "GET",
  });
}
