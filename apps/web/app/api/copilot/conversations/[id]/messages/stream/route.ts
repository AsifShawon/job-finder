import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { API_BASE } from "@/lib/api-base";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearSessionCookies,
  setSessionCookies,
} from "@/lib/session-cookies";

async function callStream(path: string, token: string | undefined, body: unknown) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  console.log("[DEBUG] Next.js stream route handler called with conversation ID:", id);
  const body = await request.json();
  console.log("[DEBUG] Next.js stream route body:", body);
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  console.log("[DEBUG] Next.js access token present:", !!accessToken, "refresh token present:", !!refreshToken);
  const path = `/api/v1/copilot/conversations/${id}/messages/stream`;

  console.log("[DEBUG] Calling backend path:", path);
  let backend = await callStream(path, accessToken, body);
  console.log("[DEBUG] Backend response status:", backend.status);
  let nextAccessToken: string | null = null;
  let nextRefreshToken: string | null = null;

  if (backend.status === 401 && refreshToken) {
    const refreshResponse = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });

    if (!refreshResponse.ok) {
      const response = NextResponse.json({ detail: "Session expired" }, { status: 401 });
      clearSessionCookies(response);
      return response;
    }

    const refreshed = await refreshResponse.json();
    nextAccessToken = refreshed.access_token as string;
    nextRefreshToken = refreshed.refresh_token as string;
    backend = await callStream(path, nextAccessToken, body);
  }

  if (!backend.body) {
    return NextResponse.json({ detail: "Streaming response unavailable" }, { status: backend.status });
  }

  const response = new NextResponse(backend.body, {
    status: backend.status,
    headers: {
      "Content-Type": backend.headers.get("Content-Type") ?? "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });

  if (nextAccessToken && nextRefreshToken) {
    setSessionCookies(response, nextAccessToken, nextRefreshToken);
  }

  return response;
}
