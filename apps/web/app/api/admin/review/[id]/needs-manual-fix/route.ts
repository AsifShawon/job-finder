import { NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/proxy-auth";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyWithSession({
    path: `/api/v1/admin/review/${id}/needs-manual-fix`,
    method: "POST",
  });
}
