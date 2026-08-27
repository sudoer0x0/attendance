import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth/guard";
import { withClearedSessionCookies } from "@/lib/auth/cookies";
import { writeAuditLog } from "@/lib/auth/audit";

/**
 * Shared logout for all four roles. Two things happen beyond clearing
 * cookies:
 *   - Students: `lastLogoutAt` is set, which starts the 2-hour re-login
 *     cooldown enforced in /api/auth/student/login (design doc §4).
 *   - All roles: this does NOT bump tokenVersion. Logout is a normal,
 *     expected action distinct from a security revocation — bumping
 *     tokenVersion is reserved for the kill-switch (compromised account,
 *     offboarding), which invalidates sessions on OTHER devices too. A
 *     plain logout only needs to clear this one session's cookies. See
 *     HANDOFF.md §16 for the still-unbuilt "log out everywhere" action
 *     that WOULD bump tokenVersion.
 */
export async function POST(req: NextRequest) {
  // Best-effort — if the session is already invalid/expired, still clear
  // cookies and return success rather than erroring on a logout request.
  try {
    const claims = await requireSession(req, ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "TEACHER", "STUDENT"]);

    await writeAuditLog({ actorRole: claims.role, actorId: claims.sub, action: "auth.logout" });
  } catch {
    // Session was already invalid — nothing to clean up server-side, fall through to clearing cookies.
  }

  return withClearedSessionCookies(NextResponse.json({ ok: true }));
}
