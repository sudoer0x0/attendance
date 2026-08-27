import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { hashPassword, generateBackupCode } from "@/lib/auth/password";
import { writeAuditLog } from "@/lib/auth/audit";
import { sendTemporaryPasswordEmail, emailSendingEnabled } from "@/lib/email/resend";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  try {
    const claims = await requireSession(req, ["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);
    const { searchParams } = new URL(req.url);
    const departmentId = claims.departmentId ?? searchParams.get("departmentId") ?? undefined;
    if (!departmentId) return NextResponse.json({ error: "departmentId is required" }, { status: 400 });

    const teachers = await db.teacher.findMany({
      where: { departmentId },
      select: {
        id: true,
        email: true,
        fullName: true,
        active: true,
        mustChangePassword: true,
        lastLoginAt: true,
        _count: { select: { courses: true } },
      },
      orderBy: { fullName: "asc" },
    });
    return NextResponse.json(teachers);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}

const createSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  departmentId: z.string().optional(), // only honored for SUPER_ADMIN
});

export async function POST(req: NextRequest) {
  try {
    const claims = await requireSession(req, ["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const { fullName, email } = parsed.data;
    const departmentId =
      claims.role === "SUPER_ADMIN"
        ? parsed.data.departmentId ?? claims.departmentId
        : claims.departmentId;

    if (!departmentId) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 });
    }

    // Temporary password — forced reset + mandatory TOTP enrollment on
    // first login via /login/setup, same pattern as department creation.
    // See HANDOFF.md re: this should go through Resend rather than being
    // returned directly, before this handles real accounts.
    const tempPassword = generateBackupCode() + randomBytes(2).toString("hex");
    const passwordHash = await hashPassword(tempPassword);

    const teacher = await db.teacher.create({
      data: { email, fullName, passwordHash, departmentId },
    });

    await writeAuditLog({
      actorRole: claims.role,
      actorId: claims.sub,
      action: "teacher.created",
      targetType: "Teacher",
      targetId: teacher.id,
      metadata: { email },
    });

    await sendTemporaryPasswordEmail(email, fullName, tempPassword);

    return NextResponse.json(
      { id: teacher.id, email, ...(emailSendingEnabled() ? {} : { temporaryPassword: tempPassword }) },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A teacher with this email already exists." }, { status: 409 });
    }
    throw err;
  }
}
