import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { API_BASE } from "@/lib/api-base";
import { REFRESH_TOKEN_COOKIE, clearSessionCookies } from "@/lib/session-cookies";

export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (refreshToken) {
    await fetch(`${API_BASE}/api/v1/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
  }

  const response = NextResponse.json({ message: "Logged out" }, { status: 200 });
  clearSessionCookies(response);
  return response;
}
