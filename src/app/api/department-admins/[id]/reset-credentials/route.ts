import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError } from "@/lib/auth/guard";
import { resetDepartmentAdminCredentials } from "@/lib/auth/account-actions";
import { writeAuditLog } from "@/lib/auth/audit";
import { sendTemporaryPasswordEmail, emailSendingEnabled } from "@/lib/email/resend";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireSession(req, ["SUPER_ADMIN"]);
    const { id } = await params;

    const admin = await db.departmentAdmin.findUnique({ where: { id } });
    if (!admin) return NextResponse.json({ error: "Departmental Admin not found" }, { status: 404 });

    const temporaryPassword = await resetDepartmentAdminCredentials(id);

    await writeAuditLog({
      actorRole: "SUPER_ADMIN",
      actorId: claims.sub,
      action: "department_admin.credentials_reset",
      targetType: "DepartmentAdmin",
      targetId: id,
    });

    await sendTemporaryPasswordEmail(admin.email, admin.fullName, temporaryPassword);

    return NextResponse.json({
      email: admin.email,
      ...(emailSendingEnabled() ? {} : { temporaryPassword }),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    throw err;
  }
}
