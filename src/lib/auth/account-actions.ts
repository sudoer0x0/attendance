import { db } from "@/lib/db";
import { hashPassword, generateBackupCode } from "@/lib/auth/password";
import { randomBytes } from "crypto";
import { redis } from "@/lib/redis";

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

function generateTempPassword(): string {
  return generateBackupCode() + randomBytes(2).toString("hex");
}

export async function resetTeacherCredentials(id: string): Promise<string> {
  const teacher = await db.teacher.findUnique({ where: { id } });
  if (teacher) {
    try {
      await redis.del(`login_attempts:${teacher.email.toLowerCase()}`);
      await redis.del(`setup_attempts:${teacher.id}`);
    } catch {
      // Redis cleanup best-effort
    }
  }

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
  const admin = await db.departmentAdmin.findUnique({ where: { id } });
  if (admin) {
    try {
      await redis.del(`login_attempts:${admin.email.toLowerCase()}`);
      await redis.del(`setup_attempts:${admin.id}`);
    } catch {
      // Redis cleanup best-effort
    }
  }

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
