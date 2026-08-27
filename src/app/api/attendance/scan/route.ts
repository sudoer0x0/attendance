import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { redeemToken } from "@/lib/qr/token";
import { writeAuditLog } from "@/lib/auth/audit";

/**
 * The single most security-critical endpoint in the system. Every control
 * from design doc §2 and §4 converges here:
 *
 *   1. requireSession(["STUDENT"]) — confirms the caller has a valid,
 *      non-revoked student session (kill-switch checked live, not cached).
 *   2. Device identity check — claims.deviceId (signed into the JWT at
 *      login, not client-supplied) is compared against the live
 *      student.currentDeviceId. This closes the earlier gap where a
 *      stolen-but-valid session cookie plus a spoofed request field could
 *      pass; now the device identity itself is part of what's signed and
 *      verified. See HANDOFF.md §8/§12 gap 3 for the before/after.
 *   3. redeemToken(...) — atomic one-time redemption. This is what stops a
 *      screenshotted/forwarded QR from working for more than one person,
 *      independent of the 5-second rotation.
 *   4. Attendance @@unique([sessionId, studentId]) — DB-level guarantee
 *      that even a redeemed token can't double-mark the same student.
 */

const bodySchema = z.object({
  sessionId: z.string().min(1),
  token: z.string().length(32),
});

export async function POST(req: NextRequest) {
  try {
    const claims = await requireSession(req, ["STUDENT"]);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Malformed scan request" }, { status: 400 });
    }
    const { sessionId, token } = parsed.data;
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";

    const student = await db.student.findUnique({ where: { id: claims.sub } });
    if (!student || !student.active) {
      throw new UnauthorizedError("Student account not active");
    }

    // Device identity now travels inside the signed JWT (set at login,
    // see student/webauthn/auth-verify/route.ts) rather than as a
    // client-supplied request field — closes the gap flagged in this
    // file's earlier revision and in HANDOFF.md §8/§12 gap 3. A token
    // signed under a device that's since been re-registered (support
    // flow, lost phone) is rejected here even if otherwise valid.
    if (student.currentDeviceId && claims.deviceId && claims.deviceId !== student.currentDeviceId) {
      await writeAuditLog({
        actorRole: "STUDENT",
        actorId: student.id,
        action: "attendance.scan_rejected_device_mismatch",
        targetType: "Session",
        targetId: sessionId,
        ipAddress: ip,
      });
      return NextResponse.json(
        { error: "This session is no longer valid for this device. Sign in again." },
        { status: 403 }
      );
    }

    const session = await db.session.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== "ACTIVE") {
      return NextResponse.json({ error: "This session is not currently active." }, { status: 409 });
    }

    const result = await redeemToken(sessionId, session.qrSecret, token);
    if (!result.ok) {
      const message =
        result.reason === "already_used"
          ? "This code has already been used. Ask your lecturer to check you in manually if this wasn't you."
          : "This code is invalid or has expired — the QR refreshes every few seconds, try scanning again.";
      await writeAuditLog({
        actorRole: "STUDENT",
        actorId: student.id,
        action: `attendance.scan_rejected_${result.reason}`,
        targetType: "Session",
        targetId: sessionId,
        ipAddress: ip,
      });
      return NextResponse.json({ error: message }, { status: 409 });
    }

    // DB-level unique constraint on (sessionId, studentId) is the final
    // backstop against double marking — catch and translate that specific
    // failure into a friendly response rather than a generic 500.
    try {
      const attendance = await db.attendance.create({
        data: {
          sessionId,
          studentId: student.id,
          method: "QR",
          deviceId: student.currentDeviceId, // recorded from the DB for audit purposes, not client-supplied
          ipAddress: ip,
        },
      });
      return NextResponse.json({ ok: true, timestamp: attendance.timestamp });
    } catch {
      return NextResponse.json({ ok: true, alreadyMarked: true });
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
