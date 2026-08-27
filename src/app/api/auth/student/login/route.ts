import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { withSessionCookies } from "@/lib/auth/cookies";
import { writeAuditLog } from "@/lib/auth/audit";
import { getLoginSecurityConfig } from "@/lib/auth/system-config";
import { redis } from "@/lib/redis";

const bodySchema = z.object({
  matricNo: z.string().min(1),
  surname: z.string().min(1),
  password: z.string().min(1),
});

const GENERIC_ERROR = "Incorrect matric number, surname, or password.";

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
  const { matricNo, surname, password } = parsed.data;
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  const {
    loginMaxAttempts: MAX_ATTEMPTS,
    loginLockoutMinutes: LOCKOUT_MINUTES,
    studentLoginCooldownHours: COOLDOWN_HOURS,
  } = await getLoginSecurityConfig();

  const rateLimitKey = `student_login_attempts:${matricNo}`;
  const attempts = await redis.incr(rateLimitKey);
  if (attempts === 1) await redis.expire(rateLimitKey, LOCKOUT_MINUTES * 60);
  if (attempts > MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${LOCKOUT_MINUTES} minutes.` },
      { status: 429 }
    );
  }

  const student = await db.student.findUnique({ where: { matricNo } });
  if (
    !student ||
    !student.active ||
    !student.passwordHash ||
    student.surname.trim().toLowerCase() !== surname.trim().toLowerCase()
  ) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const passwordOk = await verifyPassword(student.passwordHash, password);
  if (!passwordOk) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  await redis.del(rateLimitKey);

  await db.student.update({
    where: { id: student.id },
    data: { lastLoginAt: new Date() },
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

  return withSessionCookies(NextResponse.json({ ok: true, studentId: student.id }), accessToken, refreshToken);
}
