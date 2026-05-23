import { NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/proxy-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const body = await req.json();
  return proxyWithSession({
    path: `/api/v1/admin/crawl-runs/${runId}/batch/run-ai`,
    method: "POST",
    body,
  });
}
