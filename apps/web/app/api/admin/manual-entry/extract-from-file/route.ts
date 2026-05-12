import { NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/proxy-auth";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  return proxyWithSession({
    path: "/api/v1/admin/manual-entry/extract-from-file",
    method: "POST",
    body: formData,
  });
}
