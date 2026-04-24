import { NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/proxy-auth";

interface RouteContext {
  params: Promise<{
    opportunityId: string;
  }>;
}

export async function POST(_: NextRequest, context: RouteContext) {
  const { opportunityId } = await context.params;
  return proxyWithSession({
    path: `/api/v1/saved/${opportunityId}`,
    method: "POST",
  });
}

export async function DELETE(_: NextRequest, context: RouteContext) {
  const { opportunityId } = await context.params;
  return proxyWithSession({
    path: `/api/v1/saved/${opportunityId}`,
    method: "DELETE",
  });
}
