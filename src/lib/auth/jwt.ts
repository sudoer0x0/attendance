import { SignJWT, jwtVerify } from "jose";

export type Role = "SUPER_ADMIN" | "DEPARTMENT_ADMIN" | "TEACHER" | "STUDENT";

export interface SessionClaims {
  sub: string; // user id
  role: Role;
  departmentId?: string; // present for DEPARTMENT_ADMIN / TEACHER — scopes their queries, see §9
  tokenVersion: number; // must match the current DB value or the token is dead — the kill-switch
  deviceId?: string; // STUDENT only — the WebAuthn credential ID that produced this session,
  // signed into the token itself so it can't be spoofed by a client-supplied
  // request field. See scan/route.ts and HANDOFF.md §8/§12 gap 3 — this is
  // what closes the "stolen session cookie + spoofed deviceId" gap flagged
  // there: the deviceId now travels inside the signed JWT, and the scan
  // route compares it against student.currentDeviceId at request time. A
  // useful side effect: if a student's device is ever re-registered
  // (support flow, lost phone), any still-valid token signed under the OLD
  // device immediately mismatches and is rejected — no separate
  // tokenVersion bump needed for that specific case.
}

const accessSecret = () => new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
const refreshSecret = () => new TextEncoder().encode(process.env.JWT_REFRESH_SECRET);

export async function signAccessToken(claims: SessionClaims): Promise<string> {
  const ttlMin = Number(process.env.JWT_ACCESS_TTL_MIN ?? 15);
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlMin}m`)
    .sign(accessSecret());
}

export async function signRefreshToken(claims: SessionClaims): Promise<string> {
  const ttlDays = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 14);
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlDays}d`)
    .sign(refreshSecret());
}

export async function verifyAccessToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret());
    return payload as unknown as SessionClaims;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, refreshSecret());
    return payload as unknown as SessionClaims;
  } catch {
    return null;
  }
}

/**
 * Every protected API route must call this AFTER verifying the JWT signature,
 * comparing claims.tokenVersion against the live DB value for that user.
 * This is what makes "revoke all sessions" instant (§10 of the design doc)
 * instead of waiting for a 15-minute access token to naturally expire.
 * See src/lib/auth/guard.ts for the wired-up version of this check.
 */
export function isTokenVersionCurrent(claimVersion: number, currentDbVersion: number): boolean {
  return claimVersion === currentDbVersion;
}
