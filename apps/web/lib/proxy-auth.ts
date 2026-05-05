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

function toResponse(payloadText: string, status: number, backendHeaders?: Headers): NextResponse {
  if (!payloadText) {
    return NextResponse.json({}, { status });
  }
  try {
    const parsed = JSON.parse(payloadText);
    return NextResponse.json(parsed, { status });
  } catch {
    const headers = new Headers();
    const contentType = backendHeaders?.get("Content-Type");
    const contentDisposition = backendHeaders?.get("Content-Disposition");
    if (contentType) {
      headers.set("Content-Type", contentType);
    }
    if (contentDisposition) {
      headers.set("Content-Disposition", contentDisposition);
    }
    return new NextResponse(payloadText, { status, headers });
  }
}

async function callBackend(path: string, method: ProxyMethod, token: string | undefined, body?: unknown): Promise<Response> {
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isFormData) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
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
    return toResponse(text, backend.status, backend.headers);
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
  const response = toResponse(text, backend.status, backend.headers);
  setSessionCookies(response, newAccessToken, newRefreshToken);
  return response;
}
