import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { API_BASE } from "@/lib/api-base";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearSessionCookies,
  setSessionCookies,
} from "@/lib/session-cookies";

type ProxyMethod = "GET" | "POST" | "PATCH" | "DELETE";

interface ProxyOptions {
  path: string;
  method: ProxyMethod;
  body?: unknown;
  request?: NextRequest;
}

function toResponse(payloadText: string, status: number): NextResponse {
  if (!payloadText) {
    return NextResponse.json({}, { status });
  }
  try {
    const parsed = JSON.parse(payloadText);
    return NextResponse.json(parsed, { status });
  } catch {
    return new NextResponse(payloadText, { status });
  }
}

async function callBackend(path: string, method: ProxyMethod, token: string | undefined, body?: unknown): Promise<Response> {
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
}

export async function proxyWithSession(options: ProxyOptions): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  let backend = await callBackend(options.path, options.method, accessToken, options.body);

  if (backend.status !== 401 || !refreshToken) {
    const text = await backend.text();
    return toResponse(text, backend.status);
  }

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
  const newAccessToken = refreshed.access_token as string;
  const newRefreshToken = refreshed.refresh_token as string;

  backend = await callBackend(options.path, options.method, newAccessToken, options.body);
  const text = await backend.text();
  const response = toResponse(text, backend.status);
  setSessionCookies(response, newAccessToken, newRefreshToken);
  return response;
}
