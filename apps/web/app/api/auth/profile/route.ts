import { NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/proxy-auth";

export async function GET() {
  return proxyWithSession({ path: "/api/v1/auth/profile", method: "GET" });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  return proxyWithSession({ path: "/api/v1/auth/profile", method: "PATCH", body });
}
