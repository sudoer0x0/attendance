import argon2 from "argon2";

// Argon2id per design doc §8 — never bcrypt/MD5. Parameters are the library's
// current recommended defaults (19 MiB memory, 2 iterations) as of argon2 v0.4x;
// revisit if OWASP guidance changes before launch.
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // Malformed hash, etc. — fail closed, never throw into a caller that
    // might treat an exception as "authenticated."
    return false;
  }
}

/** Generates a random single-use code string, e.g. for backup codes or
 *  Super-Admin recovery codes. Not a password — shorter, URL-safe, easy to
 *  transcribe by hand from a printed sheet. */
export function generateBackupCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 10).toUpperCase();
}
