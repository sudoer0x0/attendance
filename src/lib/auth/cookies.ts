import { NextResponse } from "next/server";

/**
 * Replaces the earlier localStorage-based token storage (flagged in
 * HANDOFF.md §12 gap 1 as the highest-priority security fix — localStorage
 * is readable by any script on the page, i.e. vulnerable to XSS).
 *
 * httpOnly means client-side JS (including an XSS payload) cannot read
 * these cookies at all — only the browser sends them automatically on
 * same-site requests, and only this server can read them.
 *
 * Cookies are set directly on the NextResponse being returned, rather than
 * via next/headers' cookies() — the more standard pattern for Route
 * Handlers and the one that composes cleanly with returning JSON + cookies
 * from the same response.
 */

export const ACCESS_COOKIE = "attend_access";
export const REFRESH_COOKIE = "attend_refresh";

const isProd = process.env.NODE_ENV === "production";

export function withSessionCookies(res: NextResponse, accessToken: string, refreshToken: string): NextResponse {
  const accessTtlMin = Number(process.env.JWT_ACCESS_TTL_MIN ?? 15);
  const refreshTtlDays = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 14);

  res.cookies.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: accessTtlMin * 60,
  });
  res.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/api/auth", // only sent to auth endpoints — narrows exposure of the longer-lived token
    maxAge: refreshTtlDays * 24 * 60 * 60,
  });
  return res;
}

export function withClearedSessionCookies(res: NextResponse): NextResponse {
  res.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, secure: isProd, sameSite: "lax", path: "/api/auth", maxAge: 0 });
  return res;
}
