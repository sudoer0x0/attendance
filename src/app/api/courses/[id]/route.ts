import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/auth/audit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireSession(req, ["TEACHER"]);
    const { id: courseId } = await params;

    const teacher = await db.teacher.findUnique({
      where: { id: claims.sub },
      select: { departmentId: true },
    });

    const course = await db.course.findUnique({
      where: { id: courseId },
      include: {
        sessions: {
          include: {
            _count: { select: { attendances: true } },
          },
          orderBy: [{ date: "desc" }, { startedAt: "desc" }],
        },
      },
    });

    if (!course || course.teacherId !== claims.sub) {
      throw new ForbiddenError("Course not found");
    }

    // Fetch all attendances for this course to calculate per-student attendance stats
    const courseAttendances = await db.attendance.findMany({
      where: { session: { courseId: course.id } },
      select: {
        studentId: true,
        student: {
          select: {
            id: true,
            matricNo: true,
            surname: true,
            firstName: true,
            level: { select: { name: true } },
          },
        },
      },
    });

    const totalSessions = course.sessions.length;
    const studentMap = new Map<
      string,
      {
        id: string;
        matricNo: string;
        name: string;
        level: string;
        attendedCount: number;
        totalSessions: number;
        percentage: number;
      }
    >();

    for (const a of courseAttendances) {
      const existing = studentMap.get(a.studentId);
      if (existing) {
        existing.attendedCount += 1;
        existing.percentage = totalSessions > 0 ? Math.round((existing.attendedCount / totalSessions) * 100) : 0;
      } else {
        const count = 1;
        studentMap.set(a.studentId, {
          id: a.student.id,
          matricNo: a.student.matricNo,
          name: `${a.student.surname}, ${a.student.firstName}`,
          level: a.student.level ? `${a.student.level.name} Level` : "Unassigned",
          attendedCount: count,
          totalSessions,
          percentage: totalSessions > 0 ? Math.round((count / totalSessions) * 100) : 0,
        });
      }
    }

    const studentStats = Array.from(studentMap.values()).sort((a, b) => b.attendedCount - a.attendedCount);

    return NextResponse.json({
      ...course,
      studentStats,
      totalStudentsEncountered: studentStats.length,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}

const updateSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireSession(req, ["TEACHER"]);
    const { id: courseId } = await params;
    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const course = await db.course.findUnique({ where: { id: courseId } });
    if (!course || course.teacherId !== claims.sub) {
      throw new ForbiddenError("Course not found");
    }

    const updated = await db.course.update({
      where: { id: courseId },
      data: {
        ...(parsed.data.code ? { code: parsed.data.code.trim().toUpperCase() } : {}),
        ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
      },
    });

    await writeAuditLog({
      actorRole: "TEACHER",
      actorId: claims.sub,
      action: "course.updated",
      targetType: "Course",
      targetId: courseId,
      metadata: { code: updated.code, name: updated.name },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "You already have a course with this code." }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireSession(req, ["TEACHER"]);
    const { id: courseId } = await params;

    const course = await db.course.findUnique({
      where: { id: courseId },
      include: { _count: { select: { sessions: true } } },
    });

    if (!course || course.teacherId !== claims.sub) {
      throw new ForbiddenError("Course not found");
    }

    // Soft-archive course
    await db.course.update({
      where: { id: courseId },
      data: { archivedAt: new Date() },
    });

    await writeAuditLog({
      actorRole: "TEACHER",
      actorId: claims.sub,
      action: "course.archived",
      targetType: "Course",
      targetId: courseId,
      metadata: { code: course.code, name: course.name },
    });

    return NextResponse.json({ ok: true, message: "Course archived successfully." });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
