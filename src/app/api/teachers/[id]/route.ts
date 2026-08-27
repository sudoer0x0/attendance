import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { setTeacherActive } from "@/lib/auth/account-actions";
import { writeAuditLog } from "@/lib/auth/audit";

const bodySchema = z.object({ active: z.boolean() });

/**
 * Authority model (design doc §9/§10, offboarding): a Departmental Admin
 * manages their own department's teachers directly — this is squarely
 * within their existing authority, not something that needs to route
 * through the Super Admin. Super Admin can act on any department too
 * (§7 "can take every action a departmental user can do").
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireSession(req, ["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const teacher = await db.teacher.findUnique({ where: { id } });
    if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    if (claims.role === "DEPARTMENT_ADMIN" && teacher.departmentId !== claims.departmentId) {
      throw new ForbiddenError("Not permitted for this department");
    }

    const updated = await setTeacherActive(id, parsed.data.active);

    await writeAuditLog({
      actorRole: claims.role,
      actorId: claims.sub,
      action: parsed.data.active ? "teacher.reactivated" : "teacher.deactivated",
      targetType: "Teacher",
      targetId: id,
    });

    return NextResponse.json({ id: updated.id, active: updated.active });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
