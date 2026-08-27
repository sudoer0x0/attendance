import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/auth/audit";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireSession(req, ["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;

    const level = await db.level.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });
    if (!level) return NextResponse.json({ error: "Level not found" }, { status: 404 });
    if (claims.role === "DEPARTMENT_ADMIN" && level.departmentId !== claims.departmentId) {
      throw new ForbiddenError("Not permitted for this department");
    }

    // Deliberately hard-block rather than soft-delete-and-orphan: a level
    // with students still in it almost certainly means "move them first,"
    // not "delete anyway" — silently orphaning student.levelId would leave
    // a dangling foreign key reference this schema doesn't otherwise allow.
    if (level._count.students > 0) {
      return NextResponse.json(
        { error: `${level._count.students} student(s) are still in this level. Move them to another level first.` },
        { status: 409 }
      );
    }

    await db.level.delete({ where: { id } });
    await writeAuditLog({
      actorRole: claims.role,
      actorId: claims.sub,
      action: "level.deleted",
      targetType: "Level",
      targetId: id,
      metadata: { name: level.name },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireSession(req, ["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Level name is required" }, { status: 400 });
    }

    const level = await db.level.findUnique({ where: { id } });
    if (!level) return NextResponse.json({ error: "Level not found" }, { status: 404 });
    if (claims.role === "DEPARTMENT_ADMIN" && level.departmentId !== claims.departmentId) {
      throw new ForbiddenError("Not permitted for this department");
    }

    const updated = await db.level.update({
      where: { id },
      data: { name },
    });

    await writeAuditLog({
      actorRole: claims.role,
      actorId: claims.sub,
      action: "level.renamed",
      targetType: "Level",
      targetId: id,
      metadata: { oldName: level.name, newName: name },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A level with this name already exists in this department." }, { status: 409 });
    }
    throw err;
  }
}
