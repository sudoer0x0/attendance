import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";

export async function GET(req: NextRequest) {
  try {
    await requireSession(req, ["SUPER_ADMIN"]);

    const deletedDepartments = await db.department.findMany({
      where: { deletedAt: { not: null } },
      include: {
        _count: { select: { students: true, teachers: true } },
      },
      orderBy: { deletedAt: "desc" },
    });

    return NextResponse.json(deletedDepartments);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
