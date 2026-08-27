import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireSession(req, ["TEACHER"]);
    const { id: courseId } = await params;

    const course = await db.course.findUnique({
      where: { id: courseId },
      include: {
        sessions: {
          select: { id: true, date: true, startedAt: true },
          orderBy: { date: "asc" },
        },
      },
    });

    if (!course || course.teacherId !== claims.sub) {
      throw new ForbiddenError("Course not found");
    }

    const attendances = await db.attendance.findMany({
      where: { session: { courseId: course.id } },
      select: {
        studentId: true,
        student: {
          select: {
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
        matricNo: string;
        fullName: string;
        level: string;
        count: number;
      }
    >();

    for (const a of attendances) {
      const existing = studentMap.get(a.studentId);
      if (existing) {
        existing.count += 1;
      } else {
        studentMap.set(a.studentId, {
          matricNo: a.student.matricNo,
          fullName: `${a.student.surname}, ${a.student.firstName}`,
          level: a.student.level ? `${a.student.level.name} Level` : "Unassigned",
          count: 1,
        });
      }
    }

    const rows = Array.from(studentMap.values()).sort((a, b) => a.matricNo.localeCompare(b.matricNo));

    const csvLines = [
      `Course Code,${course.code}`,
      `Course Name,${course.name.replace(/,/g, " ")}`,
      `Total Conducted Sessions,${totalSessions}`,
      `Generated At,${new Date().toISOString()}`,
      "",
      "Matric No,Student Name,Level,Attended Sessions,Total Sessions,Attendance Percentage",
      ...rows.map((r) => {
        const pct = totalSessions > 0 ? Math.round((r.count / totalSessions) * 100) : 0;
        return `"${r.matricNo}","${r.fullName}","${r.level}",${r.count},${totalSessions},${pct}%`;
      }),
    ];

    const csvContent = csvLines.join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${course.code}_attendance_report.csv"`,
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
