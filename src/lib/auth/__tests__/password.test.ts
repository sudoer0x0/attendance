import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, generateBackupCode } from "../password";

describe("hashPassword / verifyPassword", () => {
  it("a hashed password verifies successfully against the original plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword(hash, "correct horse battery staple")).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword(hash, "wrong password")).toBe(false);
  });

  it("produces a different hash each time (salted), even for the same input", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
    // Both must still independently verify correctly despite differing:
    expect(await verifyPassword(a, "same password")).toBe(true);
    expect(await verifyPassword(b, "same password")).toBe(true);
  });

  it("fails closed (returns false, does not throw) against a malformed/empty hash", async () => {
    // This matters specifically because src/lib/auth/account-actions.ts's
    // earlier (fixed) bug involved an emptied-out hash — verifyPassword
    // must never treat that as "throws an uncaught error that a caller
    // might mishandle as authenticated," it must cleanly return false.
    await expect(verifyPassword("", "anything")).resolves.toBe(false);
    await expect(verifyPassword("not-a-real-hash", "anything")).resolves.toBe(false);
  });
});

describe("generateBackupCode", () => {
  it("produces a 10-character uppercase alphanumeric code", () => {
    const code = generateBackupCode();
    expect(code).toHaveLength(10);
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });

  it("produces different codes on repeated calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateBackupCode()));
    expect(codes.size).toBe(20);
  });
});
