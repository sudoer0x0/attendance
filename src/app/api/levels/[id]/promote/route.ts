import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/auth/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const claims = await requireSession(req, ["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const targetLevelId = typeof body?.targetLevelId === "string" ? body.targetLevelId.trim() : "";

    if (!targetLevelId) {
      return NextResponse.json({ error: "Target level is required" }, { status: 400 });
    }

    if (id === targetLevelId) {
      return NextResponse.json({ error: "Source and target levels must be different" }, { status: 400 });
    }

    const [sourceLevel, targetLevel] = await Promise.all([
      db.level.findUnique({ where: { id }, include: { _count: { select: { students: true } } } }),
      db.level.findUnique({ where: { id: targetLevelId } }),
    ]);

    if (!sourceLevel) return NextResponse.json({ error: "Source level not found" }, { status: 404 });
    if (!targetLevel) return NextResponse.json({ error: "Target level not found" }, { status: 404 });

    if (sourceLevel.departmentId !== targetLevel.departmentId) {
      return NextResponse.json({ error: "Levels must belong to the same department" }, { status: 400 });
    }

    if (claims.role === "DEPARTMENT_ADMIN" && sourceLevel.departmentId !== claims.departmentId) {
      throw new ForbiddenError("Not permitted for this department");
    }

    const result = await db.student.updateMany({
      where: { levelId: id, deletedAt: null },
      data: { levelId: targetLevelId },
    });

    await writeAuditLog({
      actorRole: claims.role,
      actorId: claims.sub,
      action: "level.students_promoted",
      targetType: "Level",
      targetId: id,
      metadata: {
        fromLevel: sourceLevel.name,
        toLevel: targetLevel.name,
        count: result.count,
      },
    });

    return NextResponse.json({ ok: true, count: result.count });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
