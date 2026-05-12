import { NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/proxy-auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  return proxyWithSession({
    path: `/api/v1/copilot/conversations/${id}/messages`,
    method: "POST",
    body,
  });
}
