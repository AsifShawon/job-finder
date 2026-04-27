import { NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/proxy-auth";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const force = request.nextUrl.searchParams.get("force");
  const query = force ? `?force=${encodeURIComponent(force)}` : "";
  return proxyWithSession({
    path: `/api/v1/admin/sources/${id}/crawl${query}`,
    method: "POST",
  });
}
