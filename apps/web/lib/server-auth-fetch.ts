import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { API_BASE } from "@/lib/api-base";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";
import type { AuthUser } from "@/lib/types";

type BackendMethod = "GET" | "POST" | "PATCH" | "DELETE";

interface BackendRequestOptions {
  method?: BackendMethod;
  body?: unknown;
}

export async function fetchBackendWithAuth(path: string, options: BackendRequestOptions = {}): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  const headers = new Headers();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
}

export async function fetchBackendJsonWithAuth<T>(
  path: string,
  options: BackendRequestOptions = {},
): Promise<T | null> {
  const response = await fetchBackendWithAuth(path, options);
  if (!response.ok) {
    return null;
  }
  return response.json() as Promise<T>;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  let response: Response;
  try {
    response = await fetchBackendWithAuth("/api/v1/auth/me");
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }
  return response.json() as Promise<AuthUser>;
}

export async function requireCurrentUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login");
  }
  return user;
}

export async function requireAdminUser(): Promise<AuthUser> {
  const user = await requireCurrentUser();
  if (!user.is_admin) {
    redirect("/dashboard");
  }
  return user;
}
