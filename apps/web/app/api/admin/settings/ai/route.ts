import { NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/proxy-auth";

export async function GET() {
  return proxyWithSession({
    path: "/api/v1/admin/settings/ai",
    method: "GET",
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  return proxyWithSession({
    path: "/api/v1/admin/settings/ai",
    method: "PATCH",
    body,
  });
}
