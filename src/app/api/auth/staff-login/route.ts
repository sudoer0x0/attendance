import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { verifyTotpCode } from "@/lib/auth/totp";
import { signAccessToken, signRefreshToken, type Role } from "@/lib/auth/jwt";
import { writeAuditLog } from "@/lib/auth/audit";
import { withSessionCookies } from "@/lib/auth/cookies";
import { issueSetupToken } from "@/lib/auth/setup-token";
import { getLoginSecurityConfig } from "@/lib/auth/system-config";
import { isNewDevice } from "@/lib/auth/known-devices";
import { sendNewDeviceLoginAlert } from "@/lib/email/resend";
import { redis } from "@/lib/redis";

/**
 * Shared login endpoint for all three staff roles (§9 of the design doc:
 * "one login door, not three separate apps"). Role is resolved by which
 * table the email matches — never trust a role sent from the client.
 *
 * Generic failure messaging throughout, per design doc §4/§9 — never
 * reveal whether the email exists, whether it was the password or TOTP
 * code that was wrong, etc. This is enumeration protection.
 */

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().min(6).max(6).optional(),
  expectedRole: z.enum(["SUPER_ADMIN", "DEPARTMENT_ADMIN", "TEACHER"]).optional(),
});

const GENERIC_ERROR = "Incorrect email, password, or code.";

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
  const { email, password, totpCode, expectedRole } = parsed.data;
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  // Super-Admin-tunable via /superadmin/settings, falling back to env vars
  // until that page has been opened once — see src/lib/auth/system-config.ts.
  const { loginMaxAttempts: MAX_ATTEMPTS, loginLockoutMinutes: LOCKOUT_MINUTES } = await getLoginSecurityConfig();

  // ── Rate limiting per email — see design doc §9 "Rate-limited attempts" ──
  const rateLimitKey = `login_attempts:${email.toLowerCase()}`;
  const attempts = await redis.incr(rateLimitKey);
  if (attempts === 1) await redis.expire(rateLimitKey, LOCKOUT_MINUTES * 60);
  if (attempts > MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${LOCKOUT_MINUTES} minutes.` },
      { status: 429 }
    );
  }

  const account = await resolveStaffAccount(email);
  if (!account) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const passwordOk = await verifyPassword(account.passwordHash, password);
  if (!passwordOk) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  if (expectedRole && account.role !== expectedRole) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  if (account.mustChangePassword) {
    // Correct password on a not-yet-set-up account is a success, not a
    // failed attempt — reset the rate limit here too, matching the reset
    // on the full-login-success path below.
    await redis.del(rateLimitKey);
    // First-login: issue a short-lived setup token (same mechanism as the
    // student flow, §4/§9) that /login/setup exchanges for a new password
    // + mandatory TOTP enrollment — nothing further happens with this
    // login attempt until that's completed.
    const setupToken = await issueSetupToken(
      account.role === "TEACHER" ? "TEACHER" : "DEPARTMENT_ADMIN",
      account.id
    );
    return NextResponse.json({ requiresSetup: true, setupToken }, { status: 200 });
  }

  if (!account.totpSecretEncrypted) {
    return NextResponse.json({ error: "Account setup incomplete. Contact your administrator." }, { status: 403 });
  }

  if (!totpCode) {
    // Tell the client a TOTP prompt is needed — this is NOT the same as
    // revealing whether the password was right or wrong on its own, since
    // it's only returned after password verification already succeeded.
    return NextResponse.json({ requiresTotp: true }, { status: 200 });
  }

  const totpOk = await verifyTotpCode(account.totpSecretEncrypted, totpCode);
  if (!totpOk) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  // ── Success — reset the rate limit counter, issue tokens ──
  await redis.del(rateLimitKey);

  const claims = {
    sub: account.id,
    role: account.role,
    departmentId: account.departmentId,
    tokenVersion: account.tokenVersion,
  };
  const accessToken = await signAccessToken(claims);
  const refreshToken = await signRefreshToken(claims);

  await touchLastLogin(account.role, account.id);
  await writeAuditLog({
    actorRole: account.role,
    actorId: account.id,
    action: "auth.login_success",
    ipAddress: ip,
  });

  const userAgent = req.headers.get("user-agent") ?? "unknown";
  if (await isNewDevice(account.id, ip, userAgent)) {
    await sendNewDeviceLoginAlert(email, account.role, ip, new Date());
  }

  const portalUrl =
    account.role === "SUPER_ADMIN"
      ? `/${process.env.SUPER_ADMIN_SECRET_PATH || "superadmin"}/departments`
      : account.role === "DEPARTMENT_ADMIN"
      ? `/${process.env.DEPT_ADMIN_SECRET_PATH || "admin"}/students`
      : `/${process.env.STAFF_SECRET_PATH || "staff"}/courses`;

  return withSessionCookies(
    NextResponse.json({ role: account.role, departmentId: account.departmentId ?? null, portalUrl }),
    accessToken,
    refreshToken
  );
}

async function resolveStaffAccount(email: string): Promise<
  | {
      id: string;
      role: Role;
      passwordHash: string;
      totpSecretEncrypted: string | null;
      tokenVersion: number;
      mustChangePassword: boolean;
      departmentId?: string;
    }
  | null
> {
  const superAdmin = await db.superAdmin.findUnique({ where: { email } });
  if (superAdmin) {
    return {
      id: superAdmin.id,
      role: "SUPER_ADMIN",
      passwordHash: superAdmin.passwordHash,
      totpSecretEncrypted: superAdmin.totpSecretEncrypted,
      tokenVersion: superAdmin.tokenVersion,
      mustChangePassword: false, // Super Admin is set up once via CLI, see scripts/setup.ts
    };
  }

  const deptAdmin = await db.departmentAdmin.findUnique({ where: { email } });
  if (deptAdmin && deptAdmin.active) {
    return {
      id: deptAdmin.id,
      role: "DEPARTMENT_ADMIN",
      passwordHash: deptAdmin.passwordHash,
      totpSecretEncrypted: deptAdmin.totpSecretEncrypted,
      tokenVersion: deptAdmin.tokenVersion,
      mustChangePassword: deptAdmin.mustChangePassword,
      departmentId: deptAdmin.departmentId,
    };
  }

  const teacher = await db.teacher.findUnique({ where: { email } });
  if (teacher && teacher.active) {
    return {
      id: teacher.id,
      role: "TEACHER",
      passwordHash: teacher.passwordHash,
      totpSecretEncrypted: teacher.totpSecretEncrypted,
      tokenVersion: teacher.tokenVersion,
      mustChangePassword: teacher.mustChangePassword,
      departmentId: teacher.departmentId,
    };
  }

  return null;
}

async function touchLastLogin(role: Role, id: string) {
  if (role === "SUPER_ADMIN") await db.superAdmin.update({ where: { id }, data: { lastLoginAt: new Date() } });
  if (role === "DEPARTMENT_ADMIN") await db.departmentAdmin.update({ where: { id }, data: { lastLoginAt: new Date() } });
  if (role === "TEACHER") await db.teacher.update({ where: { id }, data: { lastLoginAt: new Date() } });
}
