import { proxyWithSession } from "@/lib/proxy-auth";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyWithSession({
    path: `/api/v1/admin/raw-documents/${id}/run-ai`,
    method: "POST",
  });
}
