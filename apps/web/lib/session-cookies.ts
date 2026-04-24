import type { NextResponse } from "next/server";

export const ACCESS_TOKEN_COOKIE = "ooi_access_token";
export const REFRESH_TOKEN_COOKIE = "ooi_refresh_token";

const isProduction = process.env.NODE_ENV === "production";

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction,
    path: "/",
    maxAge,
  };
}

export function setSessionCookies(response: NextResponse, accessToken: string, refreshToken: string): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, cookieOptions(60 * 30));
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, cookieOptions(60 * 60 * 24 * 7));
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", cookieOptions(0));
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", cookieOptions(0));
}
