import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import type { Prisma } from "@prisma/client";

type AuditLogWithActors = Prisma.AuditLogGetPayload<{
  include: {
    superAdmin: { select: { email: true } };
    departmentAdmin: { select: { email: true; fullName: true } };
    teacher: { select: { email: true; fullName: true } };
    student: { select: { matricNo: true; surname: true; firstName: true } };
  };
}>;

/**
 * Scoping note: AuditLog's actor is one of four nullable FKs (who DID the
 * thing), not who it was done TO — there's no generic "targetDepartmentId"
 * column, since targets span several unrelated entity types (Student,
 * Teacher, Department, Level, Session, ...). So a Departmental Admin's
 * view here is scoped to "actions performed by staff in my department"
 * (their own actions + their teachers'), not "every action that ever
 * touched something in my department" — e.g. a Super Admin resetting one
 * of this department's teachers WOULD show up (the Super Admin acted, but
 * see below — actually it wouldn't, since the actor is the Super Admin,
 * not department-scoped). This is an honest, deliberately narrower MVP
 * scope — see HANDOFF.md if extending this to target-based scoping later,
 * which would need a lookup keyed by targetType+targetId per entity.
 */
export async function GET(req: NextRequest) {
  try {
    const claims = await requireSession(req, ["SUPER_ADMIN", "DEPARTMENT_ADMIN"]);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
    const cursor = searchParams.get("cursor") ?? undefined;

    const where =
      claims.role === "SUPER_ADMIN"
        ? {}
        : {
            OR: [
              { departmentAdmin: { departmentId: claims.departmentId } },
              { teacher: { departmentId: claims.departmentId } },
            ],
          };

    const logs = await db.auditLog.findMany({
      where,
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        superAdmin: { select: { email: true } },
        departmentAdmin: { select: { email: true, fullName: true } },
        teacher: { select: { email: true, fullName: true } },
        student: { select: { matricNo: true, surname: true, firstName: true } },
      },
    });

    const shaped = logs.map((log: AuditLogWithActors) => ({
      id: log.id,
      action: log.action,
      actorRole: log.actorRole,
      actorLabel:
        log.superAdmin?.email ??
        log.departmentAdmin?.fullName ??
        log.teacher?.fullName ??
        (log.student ? `${log.student.surname}, ${log.student.firstName} (${log.student.matricNo})` : "System"),
      targetType: log.targetType,
      targetId: log.targetId,
      metadata: log.metadata,
      createdAt: log.createdAt,
    }));

    return NextResponse.json({ logs: shaped, nextCursor: logs.length === limit ? logs[logs.length - 1].id : null });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
