import { proxyWithSession } from "@/lib/proxy-auth";

export async function POST() {
  return proxyWithSession({
    path: "/api/v1/admin/reset-all-data",
    method: "POST",
  });
}
