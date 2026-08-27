import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { consumeSetupToken, issueSetupToken } from "@/lib/auth/setup-token";
import { hashPassword } from "@/lib/auth/password";
import { generateTotpSecret, getTotpEnrollmentUri, getTotpQrDataUrl } from "@/lib/auth/totp";
import { writeAuditLog } from "@/lib/auth/audit";

/**
 * Step 1 of staff first-login setup (§9): sets the new password and
 * generates (but does not yet finalize) a TOTP secret + enrollment QR.
 * The account only has TOTP actually enabled once
 * /api/auth/staff/verify-totp-enrollment confirms a real code from the
 * person's authenticator app — this route alone does not clear
 * mustChangePassword, deliberately, so a setup flow abandoned halfway
 * doesn't leave the account in a half-secured state.
 */

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

  const consumed = await consumeSetupToken(setupToken);
  if (!consumed || (consumed.subjectType !== "TEACHER" && consumed.subjectType !== "DEPARTMENT_ADMIN")) {
    return NextResponse.json({ error: "This setup link has expired. Start again." }, { status: 401 });
  }
  const { subjectType, subjectId } = consumed;

  const account =
    subjectType === "TEACHER"
      ? await db.teacher.findUnique({ where: { id: subjectId } })
      : await db.departmentAdmin.findUnique({ where: { id: subjectId } });

  if (!account) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const passwordHash = await hashPassword(newPassword);
  const totpSecret = generateTotpSecret();

  if (subjectType === "TEACHER") {
    await db.teacher.update({ where: { id: subjectId }, data: { passwordHash, totpSecretEncrypted: totpSecret } });
  } else {
    await db.departmentAdmin.update({ where: { id: subjectId }, data: { passwordHash, totpSecretEncrypted: totpSecret } });
  }

  await writeAuditLog({
    actorRole: subjectType,
    actorId: subjectId,
    action: "staff.password_set_first_login",
    targetType: subjectType === "TEACHER" ? "Teacher" : "DepartmentAdmin",
    targetId: subjectId,
  });

  const uri = getTotpEnrollmentUri(totpSecret, account.email, "Attend");
  const qrDataUrl = await getTotpQrDataUrl(uri);

  // A fresh setup token, re-issued, carries the person through to the
  // TOTP-verification step without re-collecting the password — same
  // "chain through the same first-login flow" pattern as the student side.
  const nextSetupToken = await issueSetupToken(subjectType, subjectId);

  return NextResponse.json({ setupToken: nextSetupToken, qrDataUrl, otpauthUri: uri });
}
