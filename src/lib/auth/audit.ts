import { db } from "@/lib/db";
import type { Role } from "./jwt";

/**
 * Append-only by convention here at the application layer; before
 * production this MUST also be enforced at the database level (a migration
 * that REVOKEs UPDATE/DELETE on this table from the app's DB role) so that
 * a compromised app-layer credential still can't rewrite history — see
 * design doc §10 "Detection" and HANDOFF.md "Security model."
 */
export async function writeAuditLog(entry: {
  actorRole: Role | "SYSTEM";
  actorId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}) {
  const roleFieldMap: Partial<Record<string, string>> = {
    SUPER_ADMIN: "superAdminId",
    DEPARTMENT_ADMIN: "departmentAdminId",
    TEACHER: "teacherId",
    STUDENT: "studentId",
  };
  const actorField = roleFieldMap[entry.actorRole];

  await db.auditLog.create({
    data: {
      actorRole: entry.actorRole as never,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata as never,
      ipAddress: entry.ipAddress,
      ...(actorField ? { [actorField]: entry.actorId } : {}),
    },
  });
}
