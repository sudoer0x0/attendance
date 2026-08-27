/**
 * Super Admin Password & 2FA Reset Tool
 *
 * Use this script if you forgot or misplaced the Super Admin password or 2FA authenticator.
 * Runs directly on the server/CLI environment where you have database access.
 *
 * Usage:
 *   npx tsx scripts/reset-super-admin.ts
 */
import { createInterface } from "readline/promises";
import { db } from "../src/lib/db";
import { hashPassword, generateBackupCode } from "../src/lib/auth/password";
import { generateTotpSecret, getTotpEnrollmentUri } from "../src/lib/auth/totp";
import { redis } from "../src/lib/redis";
import argon2 from "argon2";

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const superAdmins = await db.superAdmin.findMany();
  if (superAdmins.length === 0) {
    console.error("No Super Admin found. Run \"npx tsx scripts/setup-super-admin.ts\" first.");
    process.exit(1);
  }

  console.log("=== Super Admin Password Reset Tool ===");
  console.log(`Found ${superAdmins.length} Super Admin account(s):`);
  superAdmins.forEach((sa, i) => console.log(`  [${i + 1}] ${sa.email}`));

  const targetEmail =
    superAdmins.length === 1
      ? superAdmins[0].email
      : await rl.question("\nEnter the email of the Super Admin to reset: ");

  const admin = await db.superAdmin.findUnique({ where: { email: targetEmail.trim() } });
  if (!admin) {
    console.error(`Super Admin with email "${targetEmail}" not found.`);
    process.exit(1);
  }

  const newPassword = await rl.question("\nEnter new Super Admin password (min 12 chars): ");
  if (newPassword.length < 12) {
    console.error("Password too short — use at least 12 characters.");
    process.exit(1);
  }

  const resetTotpAnswer = await rl.question("Do you also want to reset the 2FA Authenticator? (y/N): ");
  const shouldResetTotp = resetTotpAnswer.trim().toLowerCase() === "y" || resetTotpAnswer.trim().toLowerCase() === "yes";

  const passwordHash = await hashPassword(newPassword);
  
  let totpSecret = admin.totpSecretEncrypted;
  let recoveryCodesHashed = admin.recoveryCodesHashed;
  let newRecoveryCodes: string[] = [];

  if (shouldResetTotp) {
    totpSecret = generateTotpSecret();
    newRecoveryCodes = Array.from({ length: 10 }, () => generateBackupCode());
    recoveryCodesHashed = await Promise.all(newRecoveryCodes.map((c) => argon2.hash(c)));
  }

  await db.superAdmin.update({
    where: { id: admin.id },
    data: {
      passwordHash,
      totpSecretEncrypted: totpSecret,
      recoveryCodesHashed,
      tokenVersion: { increment: 1 }, // Invalidates all existing active sessions
    },
  });

  try {
    await redis.del(`login_attempts:${admin.email.toLowerCase()}`);
  } catch {
    // Redis cleanup best-effort
  }

  console.log("\n✅ Password has been successfully reset! All prior sessions and login lockouts have been revoked.\n");

  if (shouldResetTotp && totpSecret) {
    const uri = getTotpEnrollmentUri(totpSecret, admin.email, "Attend");
    console.log("── New TOTP 2FA Enrollment ──");
    console.log("Manual Setup Key (if typing into app):", totpSecret);
    console.log("Enrollment URI:", uri);

    const QRCode = (await import("qrcode")).default;
    const terminalQr = await QRCode.toString(uri, { type: "terminal", small: true });
    console.log("\nScan this QR code with your authenticator app (Google Authenticator, Apple Passwords, Authy):\n");
    console.log(terminalQr);

    console.log("── New Recovery Codes — SAVE THESE NOW ──");
    newRecoveryCodes.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  }

  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
