import { createHmac, randomBytes } from "crypto";
import { redis } from "@/lib/redis";

/**
 * Rotating QR token engine.
 *
 * Two independent controls compose to close the loopholes discussed at
 * length in the design doc §2:
 *
 *  1. TIME ROTATION — a new token every N seconds (QR_ROTATION_SECONDS),
 *     computed server-side from `session.qrSecret`, which never leaves
 *     the server (the teacher's screen only ever receives the *token*,
 *     not the secret that generates it).
 *
 *  2. ONE-TIME REDEMPTION — the important control. Redis SETNX makes the
 *     FIRST successful scan of a given token consume it *permanently*,
 *     even if there's still time left in its rotation window. This is
 *     what stops a screenshotted/forwarded QR code from being usable by
 *     more than one person — see design doc §2 "One-time-use enforcement."
 *     Redis was chosen specifically because this needs an atomic,
 *     sub-second check-and-set — a Postgres UPDATE ... WHERE would also
 *     work but adds real latency to every scan in a live classroom.
 */

const ROTATION_SECONDS = () => Number(process.env.QR_ROTATION_SECONDS ?? 5);

export function generateSessionSecret(): string {
  return randomBytes(32).toString("hex");
}

function currentTimeStep(): number {
  return Math.floor(Date.now() / 1000 / ROTATION_SECONDS());
}

/** Computes the token that SHOULD be valid right now for a given session.
 *  Called by the teacher-facing "current QR" endpoint, polled/pushed every
 *  rotation interval. */
export function computeCurrentToken(sessionId: string, qrSecret: string): { token: string; expiresAt: number } {
  const step = currentTimeStep();
  const token = createHmac("sha256", qrSecret).update(`${sessionId}:${step}`).digest("hex").slice(0, 32);
  const expiresAt = (step + 1) * ROTATION_SECONDS() * 1000;
  return { token, expiresAt };
}

/** Also accepts the previous time-step's token with a short grace window,
 *  since a student's scan can legitimately land right at a rotation
 *  boundary (network latency, camera decode time) — this does NOT weaken
 *  one-time-use, since Redis still only lets ONE scan of that token
 *  through regardless of which step it belonged to. */
function validTokenCandidates(sessionId: string, qrSecret: string): string[] {
  const step = currentTimeStep();
  return [step, step - 1].map(
    (s) => createHmac("sha256", qrSecret).update(`${sessionId}:${s}`).digest("hex").slice(0, 32)
  );
}

export type ScanResult =
  | { ok: true }
  | { ok: false; reason: "invalid_token" | "already_used" | "session_not_active" };

/**
 * Atomically redeems a scanned token. Returns ok:true at most ONCE per
 * token, no matter how many requests arrive concurrently for it — this is
 * the actual anti-forwarding guarantee, not the 5-second rotation alone.
 */
export async function redeemToken(
  sessionId: string,
  qrSecret: string,
  submittedToken: string
): Promise<ScanResult> {
  const candidates = validTokenCandidates(sessionId, qrSecret);
  if (!candidates.includes(submittedToken)) {
    return { ok: false, reason: "invalid_token" };
  }

  const redisKey = `qr_used:${sessionId}:${submittedToken}`;
  // NX = only set if not already present; EX = auto-expire well after the
  // token's own validity window so Redis doesn't grow unbounded.
  const wasSet = await redis.set(redisKey, "1", { nx: true, ex: ROTATION_SECONDS() * 4 });

  if (wasSet === null) {
    return { ok: false, reason: "already_used" };
  }
  return { ok: true };
}
