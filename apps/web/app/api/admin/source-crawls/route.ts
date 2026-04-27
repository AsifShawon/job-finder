import { NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/proxy-auth";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { source_id?: unknown; force?: unknown };
  if (typeof body.source_id !== "number") {
    return Response.json({ detail: "source_id is required." }, { status: 400 });
  }
  const force = body.force === true;
  const query = force ? "?force=true" : "";

  return proxyWithSession({
    path: `/api/v1/admin/sources/${body.source_id}/crawl${query}`,
    method: "POST",
  });
}
