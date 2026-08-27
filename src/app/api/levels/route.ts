import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";

export async function GET(req: NextRequest) {
  try {
    const claims = await requireSession(req, ["DEPARTMENT_ADMIN", "SUPER_ADMIN", "TEACHER"]);
    const { searchParams } = new URL(req.url);
    const departmentId = claims.departmentId ?? searchParams.get("departmentId") ?? undefined;
    if (!departmentId) return NextResponse.json({ error: "departmentId is required" }, { status: 400 });

    const levels = await db.level.findMany({
      where: { departmentId },
      include: { _count: { select: { students: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(levels);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  departmentId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const claims = await requireSession(req, ["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { searchParams } = new URL(req.url);
    const departmentId =
      claims.role === "SUPER_ADMIN"
        ? parsed.data.departmentId ?? searchParams.get("departmentId") ?? claims.departmentId
        : claims.departmentId;

    if (!departmentId) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 });
    }

    const level = await db.level.create({
      data: { name: parsed.data.name, departmentId },
    });
    return NextResponse.json(level, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A level with this name already exists in your department." }, { status: 409 });
    }
    throw err;
  }
}
