import { NextRequest, NextResponse } from "next/server";

import { API_BASE } from "@/lib/api-base";
import { setSessionCookies } from "@/lib/session-cookies";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = await request.json();

  let backend: Response;
  try {
    backend = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ detail: "Sign in service is unavailable." }, { status: 503 });
  }

  const text = await backend.text();
  if (!text) {
    return NextResponse.json({}, { status: backend.status });
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return new NextResponse(text, { status: backend.status });
  }

  if (!backend.ok) {
    return NextResponse.json(data, { status: backend.status });
  }

  const response = NextResponse.json({ user: data.user }, { status: 200 });
  setSessionCookies(response, data.tokens.access_token, data.tokens.refresh_token);
  return response;
}
