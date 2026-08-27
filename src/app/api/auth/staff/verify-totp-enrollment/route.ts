import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { consumeSetupToken } from "@/lib/auth/setup-token";
import { verifyTotpCode } from "@/lib/auth/totp";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { withSessionCookies } from "@/lib/auth/cookies";
import { writeAuditLog } from "@/lib/auth/audit";

/**
 * Step 2 of staff first-login setup (§9). Only after a real 6-digit code
 * from the person's own authenticator app is verified does this clear
 * mustChangePassword and mark totpEnrolledAt — an abandoned setup attempt
 * (password set, TOTP never confirmed) leaves the account still gated at
 * login, not half-secured.
 */

const bodySchema = z.object({
  setupToken: z.string().min(1),
  totpCode: z.string().length(6),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { setupToken, totpCode } = parsed.data;

  const consumed = await consumeSetupToken(setupToken);
  if (!consumed || (consumed.subjectType !== "TEACHER" && consumed.subjectType !== "DEPARTMENT_ADMIN")) {
    return NextResponse.json({ error: "This setup link has expired. Start again." }, { status: 401 });
  }
  const { subjectType, subjectId } = consumed;

  const account =
    subjectType === "TEACHER"
      ? await db.teacher.findUnique({ where: { id: subjectId } })
      : await db.departmentAdmin.findUnique({ where: { id: subjectId } });

  if (!account || !account.totpSecretEncrypted) {
    return NextResponse.json({ error: "Setup session is invalid. Start again." }, { status: 400 });
  }

  const ok = await verifyTotpCode(account.totpSecretEncrypted, totpCode);
  if (!ok) {
    // Deliberately DON'T re-issue another setup token here — the person is
    // still mid-flow with the one that (if not yet expired) they can retry
    // with. A generic message; no hint about which digit was wrong.
    return NextResponse.json({ error: "That code didn't match. Check your authenticator app and try again." }, { status: 401 });
  }

  if (subjectType === "TEACHER") {
    await db.teacher.update({
      where: { id: subjectId },
      data: { mustChangePassword: false, totpEnrolledAt: new Date() },
    });
  } else {
    await db.departmentAdmin.update({
      where: { id: subjectId },
      data: { mustChangePassword: false, totpEnrolledAt: new Date() },
    });
  }

  await writeAuditLog({
    actorRole: subjectType,
    actorId: subjectId,
    action: "staff.totp_enrolled_first_login",
    targetType: subjectType === "TEACHER" ? "Teacher" : "DepartmentAdmin",
    targetId: subjectId,
  });

  // Setup is now fully complete — sign them in immediately rather than
  // making them go through /login again right after finishing setup.
  const role = subjectType;
  const departmentId = "departmentId" in account ? account.departmentId : undefined;
  const claims = { sub: subjectId, role, departmentId, tokenVersion: account.tokenVersion };
  const accessToken = await signAccessToken(claims);
  const refreshToken = await signRefreshToken(claims);

  return withSessionCookies(
    NextResponse.json({ ok: true, role, departmentId: departmentId ?? null }),
    accessToken,
    refreshToken
  );
}
