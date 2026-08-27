import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";

export async function GET(req: NextRequest) {
  try {
    const claims = await requireSession(req, ["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);
    const { searchParams } = new URL(req.url);
    const departmentId = claims.departmentId ?? searchParams.get("departmentId") ?? undefined;
    if (!departmentId) return NextResponse.json({ error: "departmentId is required" }, { status: 400 });

    const students = await db.student.findMany({
      where: { departmentId, deletedAt: { not: null } },
      include: { level: true },
      orderBy: { deletedAt: "desc" },
    });

    return NextResponse.json(students);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
