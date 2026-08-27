import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { computeCurrentToken } from "@/lib/qr/token";

/**
 * Polled by the teacher's screen every QR_ROTATION_SECONDS (a lightweight
 * poll rather than a WebSocket push in this scaffold — see HANDOFF.md
 * "Deviations from the design doc" for the reasoning and how to upgrade
 * this to a real-time push later without changing the security model at
 * all, since the token computation itself is unchanged either way).
 *
 * Critically, this only ever returns the TOKEN, never `session.qrSecret` —
 * the secret that generates tokens never leaves the server, per design
 * doc §2.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireSession(req, ["TEACHER"]);
    const { id: sessionId } = await params;

    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: { course: true },
    });

    if (!session || session.course.teacherId !== claims.sub) {
      // Same generic shape whether it doesn't exist or belongs to someone
      // else — don't leak which via the error message.
      throw new ForbiddenError("Session not found");
    }

    if (session.status !== "ACTIVE") {
      return NextResponse.json({ error: "Session has ended" }, { status: 409 });
    }

    const { token, expiresAt } = computeCurrentToken(session.id, session.qrSecret);
    const checkedInCount = await db.attendance.count({ where: { sessionId: session.id } });

    return NextResponse.json({ token, expiresAt, checkedInCount });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
