import { NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/proxy-auth";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  return proxyWithSession({
    path: `/api/v1/admin/opportunities/${id}/review-status`,
    method: "PATCH",
    body,
  });
}
