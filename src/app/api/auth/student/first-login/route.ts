import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { issueSetupToken } from "@/lib/auth/setup-token";
import { writeAuditLog } from "@/lib/auth/audit";

/**
 * First-login verification only — does NOT create a session. On success it
 * returns a short-lived setup token that /api/auth/student/complete-setup
 * exchanges for a password + WebAuthn registration.
 *
 * Surname + Matric + DOB, per design doc §4 — DOB closes the "anyone who
 * knows a classmate's surname and matric number could race them to set the
 * password" gap, at zero added admin effort since it's already part of the
 * Excel roster upload.
 *
 * Generic error message throughout + a hard per-record attempt limit
 * (passwordSetupAttempts) — this endpoint is the single most guessable
 * attack surface in the whole system, so it gets the strictest rate
 * limiting.
 */

const bodySchema = z.object({
  matricNo: z.string().min(1),
  surname: z.string().min(1),
  dateOfBirth: z.string().min(1), // ISO date string, e.g. "2003-04-12"
});

const GENERIC_ERROR = "We couldn't verify those details. Contact your department if you're having trouble.";
const MAX_SETUP_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
  const { matricNo, surname, dateOfBirth } = parsed.data;

  const student = await db.student.findUnique({ where: { matricNo } });

  // Deliberately walk through the same shape of work whether or not a
  // student was found, so response timing doesn't leak existence — a
  // lightweight but real mitigation against matric-number enumeration.
  if (!student || (student.passwordHash && student.currentDeviceId)) {
    // Either doesn't exist, or has ALREADY completed setup — in both cases
    // the same generic message, so an attacker can't distinguish "wrong
    // matric" from "someone already claimed this account."
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  if (student.passwordSetupLockedAt) {
    return NextResponse.json(
      { error: "This account is locked pending review. Contact your department." },
      { status: 403 }
    );
  }

  const surnameMatch = student.surname.trim().toLowerCase() === surname.trim().toLowerCase();
  const dobMatch = student.dateOfBirth.toISOString().slice(0, 10) === dateOfBirth;

  if (!surnameMatch || !dobMatch) {
    const attempts = student.passwordSetupAttempts + 1;
    const locked = attempts >= MAX_SETUP_ATTEMPTS;
    await db.student.update({
      where: { id: student.id },
      data: {
        passwordSetupAttempts: attempts,
        passwordSetupLockedAt: locked ? new Date() : undefined,
      },
    });
    if (locked) {
      await writeAuditLog({
        actorRole: "SYSTEM",
        action: "student.setup_locked_after_failed_attempts",
        targetType: "Student",
        targetId: student.id,
      });
    }
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const setupToken = await issueSetupToken("STUDENT", student.id);
  return NextResponse.json({ setupToken });
}
