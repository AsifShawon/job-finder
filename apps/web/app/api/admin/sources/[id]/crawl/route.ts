import { NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/proxy-auth";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyWithSession({
    path: `/api/v1/admin/sources/${id}/crawl`,
    method: "POST",
  });
}
