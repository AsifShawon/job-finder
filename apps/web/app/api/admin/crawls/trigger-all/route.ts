import { proxyWithSession } from "@/lib/proxy-auth";

export async function POST() {
  return proxyWithSession({ path: "/api/v1/admin/crawls/trigger-all", method: "POST" });
}
