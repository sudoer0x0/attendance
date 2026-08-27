import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyAccessToken, isTokenVersionCurrent, type Role, type SessionClaims } from "./jwt";
import { ACCESS_COOKIE } from "./cookies";

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

/**
 * Central auth check for every API route in the app. Deliberately re-reads
 * tokenVersion from the DB on every request (not cached) — the whole point
 * of the kill-switch (§10) is that a revoked session dies on its NEXT
 * request, not after the access token's 15-minute natural expiry.
 *
 * Reads the access token from the httpOnly `attend_access` cookie — see
 * src/lib/auth/cookies.ts and HANDOFF.md §12 gap 1 for why this replaced
 * the earlier Authorization-header/localStorage approach.
 */
export async function requireSession(req: NextRequest, allowedRoles: Role[]): Promise<SessionClaims> {
  const token = req.cookies.get(ACCESS_COOKIE)?.value ?? null;
  if (!token) throw new UnauthorizedError("Missing session token");

  const claims = await verifyAccessToken(token);
  if (!claims) throw new UnauthorizedError("Invalid or expired session token");

  if (!allowedRoles.includes(claims.role)) {
    // Deliberately the SAME error class/response shape as "not logged in"
    // would be for a route-guessing attempt — see design doc §9 on the
    // backend (not the URL) being the real security boundary.
    throw new ForbiddenError("Not permitted for this role");
  }

  const currentVersion = await getCurrentTokenVersion(claims.role, claims.sub);
  if (currentVersion === null || !isTokenVersionCurrent(claims.tokenVersion, currentVersion)) {
    throw new UnauthorizedError("Session has been revoked");
  }

  return claims;
}

export async function getCurrentTokenVersion(role: Role, id: string): Promise<number | null> {
  switch (role) {
    case "SUPER_ADMIN": {
      const u = await db.superAdmin.findUnique({ where: { id }, select: { tokenVersion: true } });
      return u?.tokenVersion ?? null;
    }
    case "DEPARTMENT_ADMIN": {
      const u = await db.departmentAdmin.findUnique({
        where: { id },
        select: { tokenVersion: true, active: true },
      });
      return u?.active ? u.tokenVersion : null; // deactivated admin = dead session, see §10 offboarding
    }
    case "TEACHER": {
      const u = await db.teacher.findUnique({
        where: { id },
        select: { tokenVersion: true, active: true },
      });
      return u?.active ? u.tokenVersion : null;
    }
    case "STUDENT": {
      const u = await db.student.findUnique({
        where: { id },
        select: { tokenVersion: true, active: true },
      });
      return u?.active ? u.tokenVersion : null;
    }
  }
}
