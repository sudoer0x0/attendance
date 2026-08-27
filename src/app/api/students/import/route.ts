import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/auth/audit";

/**
 * Expects columns (in this order, header row required): Surname, First
 * Name, Middle Name, Matric No, Date of Birth (YYYY-MM-DD).
 *
 * Two-step by design — see design doc §6 "preview before committing":
 *   ?mode=preview  → parses and validates only, returns a diff, writes nothing
 *   ?mode=commit   → actually inserts the validated rows
 * The UI is expected to call preview first, show the counts to the admin,
 * then call commit only after confirmation.
 */
export async function POST(req: NextRequest) {
  try {
    const claims = await requireSession(req, ["DEPARTMENT_ADMIN", "SUPER_ADMIN"]);
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") === "commit" ? "commit" : "preview";
    const levelId = searchParams.get("levelId");
    const departmentId = claims.departmentId ?? searchParams.get("departmentId");

    if (!levelId || !departmentId) {
      return NextResponse.json({ error: "levelId and departmentId are required" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    // `any` (not `unknown`) is deliberate here: exceljs transitively bundles
    // its own older @types/node via @fast-csv, so two structurally different
    // global `Buffer` declarations exist in this project simultaneously —
    // `as unknown as Buffer` still resolves to a genuine mismatch between
    // them. The runtime value is a correct Buffer either way; this is a
    // dependency type-declaration conflict, not a real type-safety gap.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()) as any);
    const sheet = workbook.worksheets[0];

    const rows: { surname: string; firstName: string; middleName?: string; matricNo: string; dateOfBirth: string }[] = [];
    const malformed: number[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header
      const [, surname, firstName, middleName, matricNo, dob] = row.values as unknown[];
      if (!surname || !firstName || !matricNo || !dob) {
        malformed.push(rowNumber);
        return;
      }
      rows.push({
        surname: String(surname).trim(),
        firstName: String(firstName).trim(),
        middleName: middleName ? String(middleName).trim() : undefined,
        matricNo: String(matricNo).trim(),
        dateOfBirth: dob instanceof Date ? dob.toISOString().slice(0, 10) : String(dob),
      });
    });

    const existing = await db.student.findMany({
      where: { matricNo: { in: rows.map((r) => r.matricNo) } },
      select: { matricNo: true },
    });
    const existingSet = new Set(existing.map((e) => e.matricNo));
    const newRows = rows.filter((r) => !existingSet.has(r.matricNo));
    const duplicateCount = rows.length - newRows.length;

    if (mode === "preview") {
      return NextResponse.json({
        newCount: newRows.length,
        duplicateCount,
        malformedCount: malformed.length,
        malformedRows: malformed,
      });
    }

    // ── commit ──
    const created = await db.student.createMany({
      data: newRows.map((r) => ({
        ...r,
        dateOfBirth: new Date(r.dateOfBirth),
        levelId,
        departmentId,
      })),
      skipDuplicates: true,
    });

    await writeAuditLog({
      actorRole: claims.role,
      actorId: claims.sub,
      action: "student.bulk_imported",
      targetType: "Level",
      targetId: levelId,
      metadata: { created: created.count, duplicates: duplicateCount, malformed: malformed.length },
    });

    return NextResponse.json({ created: created.count, duplicateCount, malformedCount: malformed.length });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: "Could not process this file. Check the format and try again." }, { status: 400 });
  }
}
