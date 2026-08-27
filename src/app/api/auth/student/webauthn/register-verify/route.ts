import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyRegistration } from "@/lib/auth/webauthn";
import { writeAuditLog } from "@/lib/auth/audit";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

const bodySchema = z.object({
  studentId: z.string().min(1),
  response: z.custom<RegistrationResponseJSON>(),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid registration response" }, { status: 400 });
  }
  const { studentId, response } = parsed.data;

  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  try {
    const verification = await verifyRegistration(studentId, response);
    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "Could not verify this device." }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;
    await db.student.update({
      where: { id: studentId },
      data: {
        currentDeviceId: credential.id,
        currentDevicePublicKey: Buffer.from(credential.publicKey).toString("base64"),
        currentDeviceCounter: credential.counter,
        currentDeviceBoundAt: new Date(),
      },
    });

    await writeAuditLog({
      actorRole: "STUDENT",
      actorId: studentId,
      action: "student.device_registered",
      targetType: "Student",
      targetId: studentId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Registration failed" },
      { status: 400 }
    );
  }
}
