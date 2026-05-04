import { NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/proxy-auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyWithSession({
    path: "/api/v1/admin/manual-entry",
    method: "POST",
    body,
  });
}
