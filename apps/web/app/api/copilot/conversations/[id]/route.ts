import { NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/proxy-auth";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyWithSession({
    path: `/api/v1/copilot/conversations/${id}`,
    method: "GET",
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyWithSession({
    path: `/api/v1/copilot/conversations/${id}`,
    method: "DELETE",
  });
}
