import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyAuthentication } from "@/lib/auth/webauthn";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { writeAuditLog } from "@/lib/auth/audit";
import { withSessionCookies } from "@/lib/auth/cookies";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

const bodySchema = z.object({
  studentId: z.string().min(1),
  response: z.custom<AuthenticationResponseJSON>(),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid authentication response" }, { status: 400 });
  }
  const { studentId, response } = parsed.data;
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student || !student.currentDevicePublicKey || student.currentDeviceCounter === null) {
    return NextResponse.json({ error: "Device not registered." }, { status: 403 });
  }

  try {
    const verification = await verifyAuthentication(
      studentId,
      response,
      student.currentDevicePublicKey,
      student.currentDeviceCounter
    );
    if (!verification.verified) {
      return NextResponse.json({ error: "Could not verify this device." }, { status: 401 });
    }

    // Update the signature counter — standard WebAuthn replay protection:
    // a cloned authenticator would produce a counter that doesn't advance,
    // which this comparison would catch on a future login.
    await db.student.update({
      where: { id: studentId },
      data: {
        currentDeviceCounter: verification.authenticationInfo.newCounter,
        lastLoginAt: new Date(),
      },
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

    return withSessionCookies(NextResponse.json({ ok: true }), accessToken, refreshToken);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sign-in failed" },
      { status: 401 }
    );
  }
}
