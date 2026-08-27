import { db } from "@/lib/db";
import { hashPassword, generateBackupCode } from "@/lib/auth/password";
import { randomBytes } from "crypto";

/**
 * Deactivating (not deleting) a Teacher or Departmental Admin account.
 * Bumping tokenVersion here is what makes this an immediate kill-switch
 * (design doc §10 "offboarding") rather than a flag that only takes
 * effect once their current access token naturally expires — see
 * src/lib/auth/guard.ts, which also independently checks `active` on
 * every request regardless of tokenVersion.
 */
export async function setTeacherActive(id: string, active: boolean) {
  return db.teacher.update({
    where: { id },
    data: { active, tokenVersion: { increment: 1 } },
  });
}

export async function setDepartmentAdminActive(id: string, active: boolean) {
  return db.departmentAdmin.update({
    where: { id },
    data: { active, tokenVersion: { increment: 1 } },
  });
}

/**
 * Admin-assisted credential reset (design doc §9/§10): clears TOTP,
 * generates a fresh temporary password, sets mustChangePassword back to
 * true, and bumps tokenVersion to kill any existing session immediately.
 * The account is routed back through the exact same first-login setup
 * flow as a brand-new account (/login/setup) the next time they sign in
 * with the new temporary password — no separate "reset" UI needed, this
 * just re-triggers the existing mustChangePassword branch in
 * /api/auth/staff-login.
 *
 * (Earlier version of this function cleared the password hash to an empty
 * string instead of issuing a new temporary one — that was a real bug:
 * staff-login checks the password BEFORE checking mustChangePassword, so
 * an emptied hash would never pass verification and the person could
 * never reach the setup flow at all. Fixed to match the same
 * temporary-password pattern used when a department is first created.)
 *
 * Authority model (§9, and the person's explicit instruction in the
 * planning conversation this was built from): a Teacher's credentials
 * are reset by their own Departmental Admin; a Departmental Admin's are
 * reset by the Super Admin. Enforced by which route calls this function
 * with which role-checked guard, not by this function itself — see the
 * two route handlers that call these.
 */
function generateTempPassword(): string {
  return generateBackupCode() + randomBytes(2).toString("hex");
}

export async function resetTeacherCredentials(id: string): Promise<string> {
  const tempPassword = generateTempPassword();
  await db.teacher.update({
    where: { id },
    data: {
      passwordHash: await hashPassword(tempPassword),
      totpSecretEncrypted: null,
      totpEnrolledAt: null,
      mustChangePassword: true,
      tokenVersion: { increment: 1 },
    },
  });
  return tempPassword;
}

export async function resetDepartmentAdminCredentials(id: string): Promise<string> {
  const tempPassword = generateTempPassword();
  await db.departmentAdmin.update({
    where: { id },
    data: {
      passwordHash: await hashPassword(tempPassword),
      totpSecretEncrypted: null,
      totpEnrolledAt: null,
      mustChangePassword: true,
      tokenVersion: { increment: 1 },
    },
  });
  return tempPassword;
}
