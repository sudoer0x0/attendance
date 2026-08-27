import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/auth/audit";
import type { Prisma } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const claims = await requireSession(req, ["SUPER_ADMIN"]);
    const { id } = await params;
    const body = await req.json();

    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : undefined;

    if (!name && !code) {
      return NextResponse.json({ error: "At least one field (name or code) is required" }, { status: 400 });
    }

    const existing = await db.department.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    if (code && code !== existing.code) {
      const duplicate = await db.department.findUnique({ where: { code } });
      if (duplicate && duplicate.id !== id) {
        return NextResponse.json({ error: `Department code '${code}' is already in use` }, { status: 409 });
      }
    }

    const updated = await db.department.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(code ? { code } : {}),
      },
    });

    await writeAuditLog({
      actorRole: "SUPER_ADMIN",
      actorId: claims.sub,
      action: "department.updated",
      targetType: "Department",
      targetId: id,
      metadata: {
        previous: { name: existing.name, code: existing.code },
        updated: { name: updated.name, code: updated.code },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const claims = await requireSession(req, ["SUPER_ADMIN"]);
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const permanent = searchParams.get("permanent") === "true";

    const department = await db.department.findUnique({
      where: { id },
      include: {
        _count: { select: { students: true, teachers: true, admins: true } },
      },
    });

    if (!department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    if (permanent) {
      // Permanent deletion: clean up all nested relations transactionally
      await db.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1. Find all teachers and their courses
        const teachers = await tx.teacher.findMany({
          where: { departmentId: id },
          select: { id: true },
        });
        const teacherIds = teachers.map((t) => t.id);

        const courses = await tx.course.findMany({
          where: { teacherId: { in: teacherIds } },
          select: { id: true },
        });
        const courseIds = courses.map((c) => c.id);

        const sessions = await tx.session.findMany({
          where: { courseId: { in: courseIds } },
          select: { id: true },
        });
        const sessionIds = sessions.map((s) => s.id);

        // Delete attendances
        await tx.attendance.deleteMany({
          where: { sessionId: { in: sessionIds } },
        });

        // Delete sessions
        await tx.session.deleteMany({
          where: { id: { in: sessionIds } },
        });

        // Delete courses
        await tx.course.deleteMany({
          where: { id: { in: courseIds } },
        });

        // Delete teachers
        await tx.teacher.deleteMany({
          where: { departmentId: id },
        });

        // Delete students (and any remaining student attendances)
        const students = await tx.student.findMany({
          where: { departmentId: id },
          select: { id: true },
        });
        const studentIds = students.map((s) => s.id);
        await tx.attendance.deleteMany({
          where: { studentId: { in: studentIds } },
        });
        await tx.student.deleteMany({
          where: { departmentId: id },
        });

        // Delete levels
        await tx.level.deleteMany({
          where: { departmentId: id },
        });

        // Delete department admins
        await tx.departmentAdmin.deleteMany({
          where: { departmentId: id },
        });

        // Delete the department row itself
        await tx.department.delete({
          where: { id },
        });
      });

      await writeAuditLog({
        actorRole: "SUPER_ADMIN",
        actorId: claims.sub,
        action: "department.permanently_deleted",
        targetType: "Department",
        targetId: id,
        metadata: {
          name: department.name,
          code: department.code,
        },
      });

      return NextResponse.json({ ok: true, permanent: true });
    }

    // Soft delete -> move to recycle bin
    await db.department.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await writeAuditLog({
      actorRole: "SUPER_ADMIN",
      actorId: claims.sub,
      action: "department.soft_deleted",
      targetType: "Department",
      targetId: id,
      metadata: {
        name: department.name,
        code: department.code,
      },
    });

    return NextResponse.json({ ok: true, soft: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
