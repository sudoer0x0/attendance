import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import type { Prisma } from "@prisma/client";

type AttendanceWithStudent = Prisma.AttendanceGetPayload<{
  include: { student: { select: { matricNo: true; surname: true; firstName: true } } };
}>;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireSession(req, ["TEACHER"]);
    const { id: sessionId } = await params;

    const session = await db.session.findUnique({ where: { id: sessionId }, include: { course: true } });
    if (!session || session.course.teacherId !== claims.sub) {
      throw new ForbiddenError("Session not found");
    }

    const attendances = await db.attendance.findMany({
      where: { sessionId },
      include: { student: { select: { matricNo: true, surname: true, firstName: true } } },
      orderBy: { timestamp: "asc" },
    });

    return NextResponse.json({
      session: { id: session.id, date: session.date, status: session.status, courseCode: session.course.code },
      attendances: attendances.map((a: AttendanceWithStudent) => ({
        id: a.id,
        matricNo: a.student.matricNo,
        surname: a.student.surname,
        firstName: a.student.firstName,
        timestamp: a.timestamp,
        method: a.method,
      })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
