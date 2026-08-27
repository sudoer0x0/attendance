import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";

export async function GET(req: NextRequest) {
  try {
    const claims = await requireSession(req, [
      "SUPER_ADMIN",
      "DEPARTMENT_ADMIN",
      "TEACHER",
      "STUDENT",
    ]);

    if (claims.role === "SUPER_ADMIN") {
      const superAdmin = await db.superAdmin.findUnique({
        where: { id: claims.sub },
        select: { id: true, email: true, createdAt: true },
      });
      return NextResponse.json({
        ...superAdmin,
        role: "SUPER_ADMIN",
        displayName: "Super Admin",
      });
    }

    if (claims.role === "DEPARTMENT_ADMIN") {
      const admin = await db.departmentAdmin.findUnique({
        where: { id: claims.sub },
        select: {
          id: true,
          email: true,
          fullName: true,
          active: true,
          department: {
            select: { id: true, name: true, code: true },
          },
        },
      });
      if (!admin) return NextResponse.json({ error: "Admin not found" }, { status: 404 });
      return NextResponse.json({
        ...admin,
        role: "DEPARTMENT_ADMIN",
        displayName: admin.fullName,
        departmentName: admin.department.name,
        departmentCode: admin.department.code,
      });
    }

    if (claims.role === "TEACHER") {
      const teacher = await db.teacher.findUnique({
        where: { id: claims.sub },
        select: {
          id: true,
          email: true,
          fullName: true,
          active: true,
          department: {
            select: { id: true, name: true, code: true },
          },
        },
      });
      if (!teacher) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
      return NextResponse.json({
        ...teacher,
        role: "TEACHER",
        displayName: teacher.fullName,
        departmentName: teacher.department.name,
        departmentCode: teacher.department.code,
      });
    }

    if (claims.role === "STUDENT") {
      const student = await db.student.findUnique({
        where: { id: claims.sub },
        select: {
          id: true,
          matricNo: true,
          surname: true,
          firstName: true,
          level: { select: { id: true, name: true } },
          department: { select: { id: true, name: true, code: true } },
        },
      });
      if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
      return NextResponse.json({
        ...student,
        role: "STUDENT",
        displayName: `${student.surname}, ${student.firstName}`,
        departmentName: student.department.name,
        departmentCode: student.department.code,
      });
    }

    return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
