import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/auth/audit";
import { redis } from "@/lib/redis";

const bodySchema = z.object({
  email: z.string().email().optional(),
  matricNo: z.string().optional(),
  studentId: z.string().optional(),
  teacherId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const claims = await requireSession(req, ["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { email, matricNo, studentId, teacherId } = parsed.data;

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();

      // Authorization check for department admin
      if (claims.role === "DEPARTMENT_ADMIN") {
        const teacher = await db.teacher.findUnique({ where: { email: normalizedEmail } });
        if (!teacher || teacher.departmentId !== claims.departmentId) {
          throw new ForbiddenError("Not permitted to unlock accounts outside your department");
        }
      }

      await redis.del(`login_attempts:${normalizedEmail}`);
      await writeAuditLog({
        actorRole: claims.role,
        actorId: claims.sub,
        action: "auth.rate_limit_cleared",
        metadata: { email: normalizedEmail },
      });

      return NextResponse.json({ ok: true, message: `Lockout cleared for ${email}.` });
    }

    if (teacherId) {
      const teacher = await db.teacher.findUnique({ where: { id: teacherId } });
      if (!teacher) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
      if (claims.role === "DEPARTMENT_ADMIN" && teacher.departmentId !== claims.departmentId) {
        throw new ForbiddenError("Not permitted for this department");
      }

      await redis.del(`login_attempts:${teacher.email.toLowerCase()}`);
      await redis.del(`setup_attempts:${teacher.id}`);
      await writeAuditLog({
        actorRole: claims.role,
        actorId: claims.sub,
        action: "teacher.unlocked",
        targetType: "Teacher",
        targetId: teacherId,
      });

      return NextResponse.json({ ok: true, message: `Lockout cleared for ${teacher.fullName}.` });
    }

    if (studentId || matricNo) {
      const student = studentId
        ? await db.student.findUnique({ where: { id: studentId } })
        : await db.student.findUnique({ where: { matricNo: matricNo! } });

      if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
      if (claims.role === "DEPARTMENT_ADMIN" && student.departmentId !== claims.departmentId) {
        throw new ForbiddenError("Not permitted for this department");
      }

      await db.student.update({
        where: { id: student.id },
        data: {
          lastLogoutAt: null,
          passwordSetupAttempts: 0,
          passwordSetupLockedAt: null,
        },
      });

      await redis.del(`student_login_attempts:${student.matricNo}`);
      await redis.del(`setup_attempts:${student.id}`);

      await writeAuditLog({
        actorRole: claims.role,
        actorId: claims.sub,
        action: "student.unlocked",
        targetType: "Student",
        targetId: student.id,
      });

      return NextResponse.json({ ok: true, message: `Lockout cleared for matric no. ${student.matricNo}.` });
    }

    return NextResponse.json({ error: "Provide an email, matric number, or account ID to unlock." }, { status: 400 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
