/**
 * One-time Super Admin setup — run this once, from the server/deploy
 * environment, never expose an equivalent as a web endpoint. See design
 * doc §9 for why: "there's nothing on the public internet that can
 * 'sign up' as Super Admin."
 *
 * Usage:
 *   npx tsx scripts/setup-super-admin.ts
 *
 * What it does:
 *   1. Prompts for email + password
 *   2. Generates a TOTP secret and prints an enrollment QR you scan with
 *      your authenticator app
 *   3. Generates 10 one-time recovery codes and prints them ONCE — copy
 *      these somewhere offline immediately, they are never shown again
 *      (see design doc §10 "Compromised Super Admin account")
 */
import { createInterface } from "readline/promises";
import { db } from "../src/lib/db";
import { hashPassword, generateBackupCode } from "../src/lib/auth/password";
import { generateTotpSecret, getTotpEnrollmentUri, getTotpQrDataUrl } from "../src/lib/auth/totp";
import argon2 from "argon2";

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const existing = await db.superAdmin.count();
  if (existing > 0) {
    console.error("A Super Admin account already exists. This script is single-use by design.");
    process.exit(1);
  }

  const email = await rl.question("Super Admin email: ");
  const password = await rl.question("Super Admin password (min 12 chars): ");
  if (password.length < 12) {
    console.error("Password too short — use at least 12 characters.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const totpSecret = generateTotpSecret();
  const uri = getTotpEnrollmentUri(totpSecret, email, "Attend");
  const qrDataUrl = await getTotpQrDataUrl(uri);

  const recoveryCodes = Array.from({ length: 10 }, () => generateBackupCode());
  const recoveryCodesHashed = await Promise.all(recoveryCodes.map((c) => argon2.hash(c)));

  await db.superAdmin.create({
    data: {
      email,
      passwordHash,
      totpSecretEncrypted: totpSecret, // TODO: encrypt at rest before production, see totp.ts note
      totpEnrolledAt: new Date(),
      recoveryCodesHashed,
    },
  });

  console.log("\n✅ Super Admin account created.\n");
  console.log("── TOTP enrollment ──");
  console.log("Manual Setup Key (if typing into app):", totpSecret);
  console.log("Enrollment URI:", uri);
  
  const QRCode = (await import("qrcode")).default;
  const terminalQr = await QRCode.toString(uri, { type: "terminal", small: true });
  console.log("\nScan this QR code with your authenticator app (Google Authenticator, Apple Passwords, Authy):\n");
  console.log(terminalQr);

  console.log("── Recovery codes — SAVE THESE NOW, they will not be shown again ──");
  recoveryCodes.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  console.log(
    "\nStore these offline (password manager or printed, locked away) — this is the ONLY way back" +
      " into the system if you lose both your password and your authenticator app. See design doc §10."
  );

  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
