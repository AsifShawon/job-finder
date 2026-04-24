import { NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/proxy-auth";

interface Params {
  params: Promise<{ alertId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { alertId } = await params;
  const body = await request.json();
  return proxyWithSession({
    path: `/api/v1/alerts/${alertId}`,
    method: "PATCH",
    body,
  });
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { alertId } = await params;
  return proxyWithSession({
    path: `/api/v1/alerts/${alertId}`,
    method: "DELETE",
  });
}
