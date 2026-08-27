import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";

export async function GET(req: NextRequest) {
  try {
    const claims = await requireSession(req, ["TEACHER"]);
    const courses = await db.course.findMany({
      where: { teacherId: claims.sub, archivedAt: null },
      include: { _count: { select: { sessions: true } } },
      orderBy: { code: "asc" },
    });
    return NextResponse.json(courses);
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
