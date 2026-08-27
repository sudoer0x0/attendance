import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/auth/audit";

/**
 * Ends a session — sets status to ENDED and stamps endedAt. The scan
 * endpoint already checks `session.status !== "ACTIVE"` (see
 * src/app/api/attendance/scan/route.ts), so this alone is sufficient to
 * lock out further QR scans immediately; no separate "freeze" step is
 * needed. Manual attendance entries can still be added after ending (not
 * yet built — see HANDOFF.md), which is intentional per design doc §5.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireSession(req, ["TEACHER"]);
    const { id: sessionId } = await params;

    const session = await db.session.findUnique({ where: { id: sessionId }, include: { course: true } });
    if (!session || session.course.teacherId !== claims.sub) {
      throw new ForbiddenError("Session not found");
    }
    if (session.status === "ENDED") {
      return NextResponse.json({ error: "This session has already ended." }, { status: 409 });
    }

    const updated = await db.session.update({
      where: { id: sessionId },
      data: { status: "ENDED", endedAt: new Date() },
    });

    await writeAuditLog({
      actorRole: "TEACHER",
      actorId: claims.sub,
      action: "session.ended",
      targetType: "Session",
      targetId: sessionId,
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
