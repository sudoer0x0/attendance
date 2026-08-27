import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/auth/audit";

/**
 * Scoped by departmentId taken from the verified JWT claims — never from a
 * query param or request body — so a Departmental Admin cannot view or
 * edit another department's roster by tampering with the request. Super
 * Admin bypasses the scope entirely (§7 "can take every action a
 * departmental user can do, for every department").
 */
export async function GET(req: NextRequest) {
  try {
    const claims = await requireSession(req, ["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);
    const { searchParams } = new URL(req.url);
    const levelId = searchParams.get("levelId") ?? undefined;
    const search = searchParams.get("search") ?? undefined;

    const departmentId =
      claims.role === "SUPER_ADMIN" ? searchParams.get("departmentId") ?? undefined : claims.departmentId;
    if (!departmentId) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 });
    }

    const students = await db.student.findMany({
      where: {
        departmentId,
        deletedAt: null, // recycle-bin pattern — soft-deleted students excluded from normal views
        levelId,
        ...(search
          ? {
              OR: [
                { surname: { contains: search, mode: "insensitive" } },
                { firstName: { contains: search, mode: "insensitive" } },
                { matricNo: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { level: true },
      orderBy: [{ surname: "asc" }, { firstName: "asc" }],
    });

    return NextResponse.json(students);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}

const createSchema = z.object({
  matricNo: z.string().min(1, "Matric number is required"),
  surname: z.string().min(1, "Surname is required"),
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  levelId: z.string().min(1, "Please select a level"),
  departmentId: z.string().optional(), // only honored for SUPER_ADMIN
});

export async function POST(req: NextRequest) {
  try {
    const claims = await requireSession(req, ["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const data = parsed.data;
    const departmentId =
      claims.role === "SUPER_ADMIN"
        ? data.departmentId ?? claims.departmentId
        : claims.departmentId;

    if (!departmentId) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 });
    }

    const student = await db.student.create({
      data: {
        matricNo: data.matricNo,
        surname: data.surname,
        firstName: data.firstName,
        middleName: data.middleName,
        dateOfBirth: new Date(data.dateOfBirth),
        levelId: data.levelId,
        departmentId,
      },
    });

    await writeAuditLog({
      actorRole: claims.role,
      actorId: claims.sub,
      action: "student.created",
      targetType: "Student",
      targetId: student.id,
      metadata: { matricNo: student.matricNo },
    });

    return NextResponse.json(student, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A student with this matric number already exists." }, { status: 409 });
    }
    throw err;
  }
}
