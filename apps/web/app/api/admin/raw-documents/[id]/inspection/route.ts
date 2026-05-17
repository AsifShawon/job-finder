import { proxyWithSession } from "@/lib/proxy-auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyWithSession({
    path: `/api/v1/admin/raw-documents/${id}/inspection`,
    method: "GET",
  });
}
