import { NextRequest } from "next/server";

import { proxyWithSession } from "@/lib/proxy-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  return proxyWithSession({
    path: `/api/v1/admin/raw-documents/${id}/save-parser-edits`,
    method: "POST",
    body,
  });
}
