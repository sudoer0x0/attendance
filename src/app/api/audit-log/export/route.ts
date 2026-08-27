import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";

export async function GET(req: NextRequest) {
  try {
    const claims = await requireSession(req, ["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);

    const where: Record<string, unknown> = {};
    if (claims.role === "DEPARTMENT_ADMIN") {
      where.departmentId = claims.departmentId;
    } else if (claims.role === "SUPER_ADMIN") {
      const urlDeptId = req.nextUrl.searchParams.get("departmentId");
      if (urlDeptId) where.departmentId = urlDeptId;
    }

    const logs = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    const escapeCsv = (val: string | null | undefined) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = ["Timestamp (UTC)", "Actor Role", "Actor Identifier", "Action", "Target Type", "Target ID", "Metadata"];
    const rows = logs.map((l) => [
      escapeCsv(l.createdAt.toISOString()),
      escapeCsv(l.actorRole),
      escapeCsv(l.superAdminId || l.departmentAdminId || l.teacherId || l.studentId || "SYSTEM"),
      escapeCsv(l.action),
      escapeCsv(l.targetType),
      escapeCsv(l.targetId),
      escapeCsv(l.metadata ? JSON.stringify(l.metadata) : ""),
    ]);

    const csvContent = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const filename = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;

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
