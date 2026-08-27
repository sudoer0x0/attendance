import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import type { Prisma } from "@prisma/client";

type AttendanceWithStudent = Prisma.AttendanceGetPayload<{
  include: { student: { select: { matricNo: true; surname: true; firstName: true } } };
}>;

/**
 * Plain CSV rather than a library-generated Excel file — genuinely
 * simpler here (no formatting/multi-sheet needs) and opens natively in
 * every spreadsheet tool without an extra dependency.
 */
function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

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
      orderBy: [{ student: { surname: "asc" } }],
    });

    const header = ["Matric No", "Surname", "First Name", "Timestamp", "Method"];
    const rows = attendances.map((a: AttendanceWithStudent) =>
      [a.student.matricNo, a.student.surname, a.student.firstName, a.timestamp.toISOString(), a.method].map(
        csvEscape
      )
    );
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");

    const filename = `${session.course.code}-${session.date.toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
