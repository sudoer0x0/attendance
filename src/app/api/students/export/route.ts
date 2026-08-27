import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";

export async function GET(req: NextRequest) {
  try {
    const claims = await requireSession(req, ["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);

    let departmentId = claims.departmentId;
    if (claims.role === "SUPER_ADMIN") {
      const urlDeptId = req.nextUrl.searchParams.get("departmentId");
      if (urlDeptId) departmentId = urlDeptId;
    }

    if (!departmentId) {
      return NextResponse.json({ error: "Department ID is required" }, { status: 400 });
    }

    const students = await db.student.findMany({
      where: {
        departmentId,
        deletedAt: null,
      },
      include: {
        level: { select: { name: true } },
        department: { select: { name: true, code: true } },
      },
      orderBy: [{ level: { name: "asc" } }, { surname: "asc" }, { firstName: "asc" }],
    });

    const escapeCsv = (val: string | null | undefined) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = ["Matric Number", "Surname", "First Name", "Middle Name", "Academic Level", "Department Code", "Enrolled Date"];
    const rows = students.map((s) => [
      escapeCsv(s.matricNo),
      escapeCsv(s.surname),
      escapeCsv(s.firstName),
      escapeCsv(s.middleName),
      escapeCsv(s.level.name),
      escapeCsv(s.department.code),
      escapeCsv(s.createdAt.toISOString().slice(0, 10)),
    ]);

    const csvContent = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const deptCode = students[0]?.department.code ?? "DEPT";
    const filename = `students_${deptCode}_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
