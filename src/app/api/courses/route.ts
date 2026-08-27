import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";

export async function GET(req: NextRequest) {
  try {
    const claims = await requireSession(req, ["TEACHER"]);
    const courses = await db.course.findMany({
      where: { teacherId: claims.sub, archivedAt: null },
      include: {
        sessions: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            date: true,
            _count: { select: { attendances: true } },
          },
          orderBy: { startedAt: "desc" },
        },
      },
      orderBy: { code: "asc" },
    });

    const enriched = courses.map((c) => {
      const activeSession = c.sessions.find((s) => s.status === "ACTIVE");
      const totalAttendances = c.sessions.reduce((acc, s) => acc + s._count.attendances, 0);
      const lastSession = c.sessions[0] ?? null;

      return {
        id: c.id,
        code: c.code,
        name: c.name,
        createdAt: c.createdAt,
        activeSession: activeSession ? { id: activeSession.id, startedAt: activeSession.startedAt } : null,
        totalAttendances,
        lastSessionDate: lastSession ? lastSession.date : null,
        _count: { sessions: c.sessions.length },
      };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}

const createSchema = z.object({ code: z.string().min(1), name: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const claims = await requireSession(req, ["TEACHER"]);
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const course = await db.course.create({
      data: { code: parsed.data.code, name: parsed.data.name, teacherId: claims.sub },
    });
    return NextResponse.json(course, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "You already have a course with this code." }, { status: 409 });
    }
    throw err;
  }
}
