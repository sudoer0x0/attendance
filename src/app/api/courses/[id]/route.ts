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
          include: { _count: { select: { attendances: true } } },
          orderBy: [{ date: "desc" }, { startedAt: "desc" }],
        },
      },
    });

    if (!course || course.teacherId !== claims.sub) {
      throw new ForbiddenError("Course not found");
    }

    return NextResponse.json(course);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
