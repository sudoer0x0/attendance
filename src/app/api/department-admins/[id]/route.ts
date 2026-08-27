import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError } from "@/lib/auth/guard";
import { setDepartmentAdminActive } from "@/lib/auth/account-actions";
import { writeAuditLog } from "@/lib/auth/audit";

const bodySchema = z.object({ active: z.boolean() });

/**
 * Super Admin only — there's no role above a Departmental Admin, per
 * design doc §9's authority model (one level up from whoever's affected).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireSession(req, ["SUPER_ADMIN"]);
    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const admin = await db.departmentAdmin.findUnique({ where: { id } });
    if (!admin) return NextResponse.json({ error: "Departmental Admin not found" }, { status: 404 });

    const updated = await setDepartmentAdminActive(id, parsed.data.active);

    await writeAuditLog({
      actorRole: "SUPER_ADMIN",
      actorId: claims.sub,
      action: parsed.data.active ? "department_admin.reactivated" : "department_admin.deactivated",
      targetType: "DepartmentAdmin",
      targetId: id,
    });

    return NextResponse.json({ id: updated.id, active: updated.active });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    throw err;
  }
}
