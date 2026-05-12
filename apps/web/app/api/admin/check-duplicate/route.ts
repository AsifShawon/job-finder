import { NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/proxy-auth";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url") ?? "";
  return proxyWithSession({
    path: `/api/v1/admin/check-duplicate?url=${encodeURIComponent(url)}`,
    method: "GET",
  });
}
