import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/auth/audit";
import { redis } from "@/lib/redis";

/**
 * Soft delete only — sets deletedAt rather than removing the row, per
 * design doc §11's recycle-bin pattern. A scheduled job (not yet
 * implemented — see HANDOFF.md) would permanently purge rows with
 * deletedAt older than 30 days. Restoring within that window is just
 * clearing deletedAt back to null (not implemented as its own endpoint
 * yet, but the data model already supports it).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireSession(req, ["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;

    const student = await db.student.findUnique({ where: { id } });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    if (claims.role === "DEPARTMENT_ADMIN" && student.departmentId !== claims.departmentId) {
      throw new ForbiddenError("Not permitted for this department");
    }

    await db.student.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAuditLog({
      actorRole: claims.role,
      actorId: claims.sub,
      action: "student.soft_deleted",
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireSession(req, ["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const student = await db.student.findUnique({ where: { id } });
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    if (claims.role === "DEPARTMENT_ADMIN" && student.departmentId !== claims.departmentId) {
      throw new ForbiddenError("Not permitted for this department");
    }

    const updates: {
      surname?: string;
      firstName?: string;
      middleName?: string | null;
      matricNo?: string;
      dateOfBirth?: Date;
      levelId?: string;
      lastLogoutAt?: null;
      passwordSetupAttempts?: number;
      passwordSetupLockedAt?: null;
      passwordHash?: null;
      currentDeviceId?: null;
      currentDevicePublicKey?: null;
      currentDeviceCounter?: null;
      currentDeviceBoundAt?: null;
      tokenVersion?: { increment: number };
    } = {};

    if (typeof body.surname === "string" && body.surname.trim()) updates.surname = body.surname.trim();
    if (typeof body.firstName === "string" && body.firstName.trim()) updates.firstName = body.firstName.trim();
    if (typeof body.middleName === "string") updates.middleName = body.middleName.trim() || null;
    if (typeof body.matricNo === "string" && body.matricNo.trim()) updates.matricNo = body.matricNo.trim();
    if (typeof body.dateOfBirth === "string" && body.dateOfBirth.trim()) {
      updates.dateOfBirth = new Date(body.dateOfBirth);
    }
    if (typeof body.levelId === "string" && body.levelId.trim()) {
      const level = await db.level.findUnique({ where: { id: body.levelId.trim() } });
      if (!level || level.departmentId !== student.departmentId) {
        return NextResponse.json({ error: "Invalid academic level for this department" }, { status: 400 });
      }
      updates.levelId = level.id;
    }

    if (body.unlock === true || body.resetAccount === true) {
      updates.lastLogoutAt = null;
      updates.passwordSetupAttempts = 0;
      updates.passwordSetupLockedAt = null;
      try {
        await redis.del(`student_login_attempts:${student.matricNo}`);
        await redis.del(`setup_attempts:${student.id}`);
      } catch {
        // Redis clear best-effort
      }
    }

    if (body.resetPassword === true || body.resetAccount === true) {
      updates.passwordHash = null;
      updates.currentDeviceId = null;
      updates.currentDevicePublicKey = null;
      updates.currentDeviceCounter = null;
      updates.currentDeviceBoundAt = null;
      updates.tokenVersion = { increment: 1 };
    }

    const updated = await db.student.update({
      where: { id },
      data: updates,
      include: { level: true },
    });

    await writeAuditLog({
      actorRole: claims.role,
      actorId: claims.sub,
      action: "student.updated",
      targetType: "Student",
      targetId: id,
      metadata: {
        matricNo: updated.matricNo,
        levelName: updated.level.name,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A student with this matric number already exists." }, { status: 409 });
    }
    throw err;
  }
}
