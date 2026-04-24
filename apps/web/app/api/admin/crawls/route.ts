import { proxyWithSession } from "@/lib/proxy-auth";

export async function GET() {
  return proxyWithSession({
    path: "/api/v1/admin/crawl-jobs",
    method: "GET",
  });
}
