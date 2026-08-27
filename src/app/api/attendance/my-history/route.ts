import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import type { Prisma } from "@prisma/client";

type AttendanceWithSession = Prisma.AttendanceGetPayload<{
  include: { session: { include: { course: true } } };
}>;

export async function GET(req: NextRequest) {
  try {
    const claims = await requireSession(req, ["STUDENT"]);
    const records = await db.attendance.findMany({
      where: { studentId: claims.sub },
      orderBy: { timestamp: "desc" },
      take: 100,
      include: { session: { include: { course: true } } },
    });

    return NextResponse.json(
      records.map((r: AttendanceWithSession) => ({
        id: r.id,
        courseCode: r.session.course.code,
        courseName: r.session.course.name,
        timestamp: r.timestamp,
        method: r.method,
      }))
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
