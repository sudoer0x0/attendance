import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/auth/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireSession(req, ["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;

    const student = await db.student.findUnique({ where: { id } });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    if (claims.role === "DEPARTMENT_ADMIN" && student.departmentId !== claims.departmentId) {
      throw new ForbiddenError("Not permitted for this department");
    }
    if (!student.deletedAt) {
      return NextResponse.json({ error: "This student isn't in the recycle bin." }, { status: 409 });
    }

    await db.student.update({ where: { id }, data: { deletedAt: null } });
    await writeAuditLog({
      actorRole: claims.role,
      actorId: claims.sub,
      action: "student.restored",
      targetType: "Student",
      targetId: id,
      metadata: { matricNo: student.matricNo },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
