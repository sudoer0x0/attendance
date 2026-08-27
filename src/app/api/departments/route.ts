import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/auth/audit";
import { hashPassword, generateBackupCode } from "@/lib/auth/password";
import { sendTemporaryPasswordEmail, emailSendingEnabled } from "@/lib/email/resend";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  try {
    await requireSession(req, ["SUPER_ADMIN"]);
    const departments = await db.department.findMany({
      where: { deletedAt: null },
      include: {
        _count: { select: { students: true, teachers: true } },
        admins: {
          select: { id: true, email: true, fullName: true, active: true, mustChangePassword: true },
        },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(departments);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(10),
  adminEmail: z.string().email(),
  adminFullName: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const claims = await requireSession(req, ["SUPER_ADMIN"]);
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const { name, code, adminEmail, adminFullName } = parsed.data;

    // Temporary password — forced reset + mandatory TOTP enrollment on
    // first login, per design doc §9. In production this would be
    // delivered to adminEmail via Resend rather than returned in the API
    // response — see HANDOFF.md "Known gaps."
    const tempPassword = generateBackupCode() + randomBytes(2).toString("hex");
    const passwordHash = await hashPassword(tempPassword);

    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const department = await tx.department.create({ data: { name, code } });
      const admin = await tx.departmentAdmin.create({
        data: { email: adminEmail, fullName: adminFullName, passwordHash, departmentId: department.id },
      });
      return { department, admin };
    });

    await writeAuditLog({
      actorRole: "SUPER_ADMIN",
      actorId: claims.sub,
      action: "department.created",
      targetType: "Department",
      targetId: result.department.id,
      metadata: { code, adminEmail },
    });

    await sendTemporaryPasswordEmail(adminEmail, adminFullName, tempPassword);

    // Only included when email isn't configured (local dev without
    // RESEND_API_KEY) — once real delivery is confirmed working, this
    // never appears in a response.
    return NextResponse.json(
      {
        department: result.department,
        adminEmail,
        ...(emailSendingEnabled() ? {} : { temporaryPassword: tempPassword }),
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A department with this code already exists." }, { status: 409 });
    }
    throw err;
  }
}
