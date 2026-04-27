import { proxyWithSession } from "@/lib/proxy-auth";

export async function GET() {
  return proxyWithSession({
    path: "/api/v1/admin/review-queue",
    method: "GET",
  });
}
