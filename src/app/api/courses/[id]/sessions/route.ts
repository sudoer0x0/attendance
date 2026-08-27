import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { generateSessionSecret } from "@/lib/qr/token";
import { writeAuditLog } from "@/lib/auth/audit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireSession(req, ["TEACHER"]);
    const { id: courseId } = await params;
    const course = await db.course.findUnique({ where: { id: courseId } });
    if (!course || course.teacherId !== claims.sub) throw new ForbiddenError("Not permitted");

    const sessions = await db.session.findMany({
      where: { courseId },
      include: { _count: { select: { attendances: true } } },
      orderBy: [{ date: "desc" }, { startedAt: "desc" }],
    });
    return NextResponse.json(sessions);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireSession(req, ["TEACHER"]);
    const { id: courseId } = await params;
    const course = await db.course.findUnique({ where: { id: courseId } });
    if (!course || course.teacherId !== claims.sub) throw new ForbiddenError("Not permitted");

    // Fresh secret per session — never reused — so a leaked secret from a
    // past (already-ended) session can't be used to forge tokens for a
    // future one. See design doc §2.
    const session = await db.session.create({
      data: { courseId, qrSecret: generateSessionSecret() },
    });

    await writeAuditLog({
      actorRole: "TEACHER",
      actorId: claims.sub,
      action: "session.created",
      targetType: "Session",
      targetId: session.id,
      metadata: { courseId },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
