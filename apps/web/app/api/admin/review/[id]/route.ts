import { NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/proxy-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  return proxyWithSession({
    path: `/api/v1/admin/review/${id}`,
    method: "PATCH",
    body,
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyWithSession({
    path: `/api/v1/admin/review/${id}`,
    method: "DELETE",
  });
}
