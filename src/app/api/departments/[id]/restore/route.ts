import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/auth/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const claims = await requireSession(req, ["SUPER_ADMIN"]);
    const { id } = await params;

    const department = await db.department.findUnique({ where: { id } });
    if (!department) return NextResponse.json({ error: "Department not found" }, { status: 404 });

    if (!department.deletedAt) {
      return NextResponse.json({ error: "This department is not in the recycle bin." }, { status: 409 });
    }

    await db.department.update({
      where: { id },
      data: { deletedAt: null },
    });

    await writeAuditLog({
      actorRole: "SUPER_ADMIN",
      actorId: claims.sub,
      action: "department.restored",
      targetType: "Department",
      targetId: id,
      metadata: { name: department.name, code: department.code },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
