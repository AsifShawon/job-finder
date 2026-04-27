import { NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/proxy-auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") ?? "1";
  const pageSize = searchParams.get("page_size") ?? "20";
  return proxyWithSession({
    path: `/api/v1/recommendations?page=${page}&page_size=${pageSize}`,
    method: "GET",
  });
}
