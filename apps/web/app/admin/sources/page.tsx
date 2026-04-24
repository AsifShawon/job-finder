import { AdminSourceManager } from "@/components/admin-source-manager";
import { fetchBackendJsonWithAuth } from "@/lib/server-auth-fetch";
import type { AdminSource } from "@/lib/types";

export default async function AdminSourcesPage() {
  const sources = (await fetchBackendJsonWithAuth<AdminSource[]>("/api/v1/admin/sources")) ?? [];

  return <AdminSourceManager initialSources={sources} />;
}
