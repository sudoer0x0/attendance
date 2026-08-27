import { NextRequest, NextResponse } from "next/server";
import { verifyRefreshToken, signAccessToken, isTokenVersionCurrent } from "@/lib/auth/jwt";
import { withSessionCookies, REFRESH_COOKIE } from "@/lib/auth/cookies";
import { getCurrentTokenVersion } from "@/lib/auth/guard";

/**
 * Called by the client when an API request comes back 401 with an expired
 * (but not revoked) access token — re-issues a fresh 15-minute access
 * token from the longer-lived refresh token, without requiring the person
 * to log in again. Still re-checks tokenVersion against the DB, so a
 * revoked session (kill-switch, deactivation) can't refresh its way back
 * to validity.
 *
 * NOTE (see HANDOFF.md): no client-side fetch wrapper calls this
 * automatically yet on a 401 — the endpoint exists and works, but wiring
 * up that interceptor is still on the "next steps" list.
 */
export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "No session to refresh" }, { status: 401 });
  }

  const claims = await verifyRefreshToken(refreshToken);
  if (!claims) {
    return NextResponse.json({ error: "Session expired. Please sign in again." }, { status: 401 });
  }

  const currentVersion = await getCurrentTokenVersion(claims.role, claims.sub);
  if (currentVersion === null || !isTokenVersionCurrent(claims.tokenVersion, currentVersion)) {
    return NextResponse.json({ error: "Session has been revoked. Please sign in again." }, { status: 401 });
  }

  const newAccessToken = await signAccessToken(claims);
  // Refresh token itself is left as-is (not rotated) — rotating refresh
  // tokens on every use is a further hardening step worth considering
  // before production, noted in HANDOFF.md.
  return withSessionCookies(NextResponse.json({ ok: true }), newAccessToken, refreshToken);
}
