import { createHash } from "crypto";
import { redis } from "@/lib/redis";

/**
 * Not device *binding* (that's WebAuthn for students, §4/§8) — this is a
 * much lighter "have we seen this device before" signal purely to decide
 * whether to fire a new-device-login email for staff accounts (§9/§10).
 * A fingerprint is just a hash of IP+User-Agent; trivially spoofable, but
 * that's fine here — worst case is a missed or extra alert, not a broken
 * security boundary (the account's actual security still rests on
 * password+TOTP+tokenVersion, unaffected by this).
 */

function fingerprint(ip: string, userAgent: string): string {
  return createHash("sha256").update(`${ip}|${userAgent}`).digest("hex").slice(0, 16);
}

const KNOWN_DEVICES_TTL_DAYS = 90;

/** Returns true if this is the first time this fingerprint has been seen
 *  for this account, and records it either way. */
export async function isNewDevice(accountId: string, ip: string, userAgent: string): Promise<boolean> {
  const key = `known_devices:${accountId}`;
  const fp = fingerprint(ip, userAgent);

  const known = await redis.get<string>(`${key}:${fp}`);
  await redis.set(`${key}:${fp}`, "1", { ex: KNOWN_DEVICES_TTL_DAYS * 24 * 60 * 60 });

  return known === null;
}
