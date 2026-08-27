import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/auth/audit";
import type { Prisma } from "@prisma/client";

type StudentIdMatric = Prisma.StudentGetPayload<{ select: { id: true; matricNo: true } }>;

/**
 * Intended trigger: Vercel Cron (see vercel.json) hitting this daily.
 * Vercel Cron sends GET requests and — when a `CRON_SECRET` env var is
 * set on the project — automatically attaches
 * `Authorization: Bearer $CRON_SECRET` itself, which is exactly what this
 * route checks for. No custom header config needed on Vercel's side.
 *
 * Permanently deletes (not soft) any student whose deletedAt is more than
 * 30 days old — this is the actual purge half of the recycle-bin pattern
 * from design doc §11. Restoring after the 30-day window is gone; the
 * nightly DB backup (see HANDOFF.md) is the longer-term safety net below
 * that, per the design doc's own honest framing of this limit.
 */
const RETENTION_DAYS = 30;

async function handlePurge(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const toPurge = await db.student.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true, matricNo: true },
  });

  if (toPurge.length > 0) {
    await db.student.deleteMany({ where: { id: { in: toPurge.map((s: StudentIdMatric) => s.id) } } });
    await writeAuditLog({
      actorRole: "SYSTEM",
      action: "student.purged_after_retention",
      metadata: { count: toPurge.length, matricNos: toPurge.map((s: StudentIdMatric) => s.matricNo) },
    });
  }

  // Purge soft-deleted departments older than 30 days
  const deptsToPurge = await db.department.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true, name: true, code: true },
  });

  for (const dept of deptsToPurge) {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const teachers = await tx.teacher.findMany({ where: { departmentId: dept.id }, select: { id: true } });
      const teacherIds = teachers.map((t) => t.id);
      const courses = await tx.course.findMany({ where: { teacherId: { in: teacherIds } }, select: { id: true } });
      const courseIds = courses.map((c) => c.id);
      const sessions = await tx.session.findMany({ where: { courseId: { in: courseIds } }, select: { id: true } });
      const sessionIds = sessions.map((s) => s.id);

      await tx.attendance.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.session.deleteMany({ where: { id: { in: sessionIds } } });
      await tx.course.deleteMany({ where: { id: { in: courseIds } } });
      await tx.teacher.deleteMany({ where: { departmentId: dept.id } });

      const students = await tx.student.findMany({ where: { departmentId: dept.id }, select: { id: true } });
      const studentIds = students.map((s) => s.id);
      await tx.attendance.deleteMany({ where: { studentId: { in: studentIds } } });
      await tx.student.deleteMany({ where: { departmentId: dept.id } });
      await tx.level.deleteMany({ where: { departmentId: dept.id } });
      await tx.departmentAdmin.deleteMany({ where: { departmentId: dept.id } });
      await tx.department.delete({ where: { id: dept.id } });
    });

    await writeAuditLog({
      actorRole: "SYSTEM",
      action: "department.purged_after_retention",
      targetType: "Department",
      targetId: dept.id,
      metadata: { name: dept.name, code: dept.code },
    });
  }

  return NextResponse.json({ purgedStudents: toPurge.length, purgedDepartments: deptsToPurge.length });
}

export async function GET(req: NextRequest) {
  return handlePurge(req);
}

export async function POST(req: NextRequest) {
  return handlePurge(req);
}
