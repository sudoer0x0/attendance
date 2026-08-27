import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { consumeSetupToken } from "@/lib/auth/setup-token";
import { hashPassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { withSessionCookies } from "@/lib/auth/cookies";
import { writeAuditLog } from "@/lib/auth/audit";

const bodySchema = z.object({
  setupToken: z.string().min(1),
  newPassword: z.string().min(10, "Use at least 10 characters."),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const { setupToken, newPassword } = parsed.data;
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  const consumed = await consumeSetupToken(setupToken);
  if (!consumed || consumed.subjectType !== "STUDENT") {
    return NextResponse.json({ error: "This setup session has expired. Please verify your details again." }, { status: 401 });
  }
  const studentId = consumed.subjectId;

  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student || !student.active) {
    return NextResponse.json({ error: "Student account not found or inactive." }, { status: 404 });
  }

  const passwordHash = await hashPassword(newPassword);
  await db.student.update({
    where: { id: studentId },
    data: {
      passwordHash,
      passwordSetupAttempts: 0,
      lastLoginAt: new Date(),
    },
  });

  await writeAuditLog({
    actorRole: "STUDENT",
    actorId: studentId,
    action: "student.password_set_first_login",
    targetType: "Student",
    targetId: studentId,
  });

  const claims = {
    sub: student.id,
    role: "STUDENT" as const,
    tokenVersion: student.tokenVersion,
    deviceId: student.currentDeviceId ?? undefined,
  };
  const accessToken = await signAccessToken(claims);
  const refreshToken = await signRefreshToken(claims);

  await writeAuditLog({
    actorRole: "STUDENT",
    actorId: student.id,
    action: "auth.login_success",
    ipAddress: ip,
  });

  return withSessionCookies(
    NextResponse.json({ ok: true, studentId }),
    accessToken,
    refreshToken
  );
}
