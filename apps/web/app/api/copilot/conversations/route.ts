import { NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/proxy-auth";

export async function GET() {
  return proxyWithSession({
    path: "/api/v1/copilot/conversations",
    method: "GET",
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  return proxyWithSession({
    path: "/api/v1/copilot/conversations",
    method: "POST",
    body,
  });
}
