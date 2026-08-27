import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/auth/audit";
import type { Prisma } from "@prisma/client";

type AttendanceWithStudent = Prisma.AttendanceGetPayload<{
  include: { student: { select: { matricNo: true; surname: true; firstName: true } } };
}>;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireSession(req, ["TEACHER"]);
    const { id: sessionId } = await params;

    const session = await db.session.findUnique({ where: { id: sessionId }, include: { course: true } });
    if (!session || session.course.teacherId !== claims.sub) {
      throw new ForbiddenError("Session not found");
    }

    const attendances = await db.attendance.findMany({
      where: { sessionId },
      include: { student: { select: { matricNo: true, surname: true, firstName: true } } },
      orderBy: { timestamp: "asc" },
    });

    return NextResponse.json({
      session: { id: session.id, date: session.date, status: session.status, courseCode: session.course.code },
      attendances: attendances.map((a: AttendanceWithStudent) => ({
        id: a.id,
        matricNo: a.student.matricNo,
        surname: a.student.surname,
        firstName: a.student.firstName,
        timestamp: a.timestamp,
        method: a.method,
        manualReason: a.manualReason,
      })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}

const manualSchema = z.object({
  matricNo: z.string().min(1).optional(),
  studentId: z.string().min(1).optional(),
  manualReason: z.string().min(1, "Reason is required for manual attendance override"),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireSession(req, ["TEACHER"]);
    const { id: sessionId } = await params;
    const parsed = manualSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    }

    const { matricNo, studentId, manualReason } = parsed.data;

    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: { course: { select: { teacherId: true, code: true } } },
    });

    if (!session || session.course.teacherId !== claims.sub) {
      throw new ForbiddenError("Session not found");
    }

    const student = studentId
      ? await db.student.findUnique({ where: { id: studentId } })
      : await db.student.findUnique({ where: { matricNo: matricNo!.trim().toUpperCase() } });

    if (!student || student.deletedAt) {
      return NextResponse.json({ error: "Student not found in department roster." }, { status: 404 });
    }

    // Check if already checked in
    const existing = await db.attendance.findUnique({
      where: { sessionId_studentId: { sessionId, studentId: student.id } },
    });

    if (existing) {
      return NextResponse.json({ error: `${student.surname}, ${student.firstName} is already marked present for this session.` }, { status: 409 });
    }

    const attendance = await db.attendance.create({
      data: {
        sessionId,
        studentId: student.id,
        method: "MANUAL",
        manualReason: manualReason.trim(),
      },
      include: {
        student: { select: { matricNo: true, surname: true, firstName: true } },
      },
    });

    await writeAuditLog({
      actorRole: "TEACHER",
      actorId: claims.sub,
      action: "attendance.manual_mark",
      targetType: "Student",
      targetId: student.id,
      metadata: {
        sessionId,
        courseCode: session.course.code,
        matricNo: student.matricNo,
        reason: manualReason.trim(),
      },
    });

    return NextResponse.json({
      ok: true,
      attendance: {
        id: attendance.id,
        matricNo: attendance.student.matricNo,
        surname: attendance.student.surname,
        firstName: attendance.student.firstName,
        timestamp: attendance.timestamp,
        method: attendance.method,
        manualReason: attendance.manualReason,
      },
    }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
