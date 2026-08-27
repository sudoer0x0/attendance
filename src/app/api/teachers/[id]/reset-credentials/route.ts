import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { resetTeacherCredentials } from "@/lib/auth/account-actions";
import { writeAuditLog } from "@/lib/auth/audit";
import { sendTemporaryPasswordEmail, emailSendingEnabled } from "@/lib/email/resend";

/**
 * Design doc §9 authority model — explicit instruction from the planning
 * conversation this was built from: "for teacher/lecturer it should be
 * able to be reset by the departmental admin also, not just [Super
 * Admin]." A Teacher's lost-authenticator or compromised-account recovery
 * is handled fully by their own Departmental Admin — see HANDOFF.md and
 * the design doc §10 for the identity-verification expectation (verify
 * through a channel you already personally trust before resetting; this
 * endpoint doesn't and can't enforce that step itself, it's a human
 * judgment call the admin makes before clicking the button).
 *
 * Returns the new temporary password in the response — in production this
 * would be delivered to the teacher via Resend rather than shown in the
 * API response (same TODO as department creation, see HANDOFF.md).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireSession(req, ["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;

    const teacher = await db.teacher.findUnique({ where: { id } });
    if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    if (claims.role === "DEPARTMENT_ADMIN" && teacher.departmentId !== claims.departmentId) {
      throw new ForbiddenError("Not permitted for this department");
    }

    const temporaryPassword = await resetTeacherCredentials(id);

    await writeAuditLog({
      actorRole: claims.role,
      actorId: claims.sub,
      action: "teacher.credentials_reset",
      targetType: "Teacher",
      targetId: id,
    });

    await sendTemporaryPasswordEmail(teacher.email, teacher.fullName, temporaryPassword);

    return NextResponse.json({
      email: teacher.email,
      ...(emailSendingEnabled() ? {} : { temporaryPassword }),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
