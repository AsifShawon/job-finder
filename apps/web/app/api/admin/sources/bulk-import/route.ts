import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { API_BASE } from "@/lib/api-base";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, setSessionCookies } from "@/lib/session-cookies";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  const formData = await request.formData();

  async function callBackend(token: string | undefined): Promise<Response> {
    return fetch(`${API_BASE}/api/v1/admin/sources/bulk-import`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  }

  let backend = await callBackend(accessToken);

  if (backend.status !== 401 || !refreshToken) {
    const text = await backend.text();
    return new NextResponse(text, { status: backend.status, headers: { "Content-Type": "application/json" } });
  }

  const refreshResponse = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });

  if (!refreshResponse.ok) {
    return NextResponse.json({ detail: "Session expired" }, { status: 401 });
  }

  const refreshed = await refreshResponse.json() as { access_token: string; refresh_token: string };
  backend = await callBackend(refreshed.access_token);
  const text = await backend.text();
  const response = new NextResponse(text, { status: backend.status, headers: { "Content-Type": "application/json" } });
  setSessionCookies(response, refreshed.access_token, refreshed.refresh_token);
  return response;
}
