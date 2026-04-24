import { NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/proxy-auth";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  return proxyWithSession({
    path: `/api/v1/admin/sources/${id}`,
    method: "PATCH",
    body,
  });
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyWithSession({
    path: `/api/v1/admin/sources/${id}`,
    method: "DELETE",
  });
}
