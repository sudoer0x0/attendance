import { describe, it, expect, vi } from "vitest";

// Mocked before importing token.ts, per Vitest's hoisting rules — the
// factory dynamically imports FakeRedis so it can construct a fresh
// instance without referencing an outer-scope variable (which hoisting
// would otherwise make inaccessible at this point in the file).
vi.mock("@/lib/redis", async () => {
  const { FakeRedis } = await import("@/test-utils/fake-redis");
  return { redis: new FakeRedis() };
});

// Use a long rotation window for these tests so token computation is
// stable across a whole test run and never flakes on a real-time rotation
// boundary — the tests care about redemption semantics, not real timing.
process.env.QR_ROTATION_SECONDS = "3600";

const { computeCurrentToken, redeemToken, generateSessionSecret } = await import("../token");

function freshSession() {
  // A fresh sessionId per test avoids needing to reset FakeRedis's shared
  // state between tests — each test's keys are namespaced by its own
  // unique session, so tests can run in any order without interference.
  return {
    sessionId: `session-${crypto.randomUUID()}`,
    qrSecret: generateSessionSecret(),
  };
}

describe("computeCurrentToken", () => {
  it("is deterministic for the same session/secret within a rotation window", () => {
    const { sessionId, qrSecret } = freshSession();
    const a = computeCurrentToken(sessionId, qrSecret);
    const b = computeCurrentToken(sessionId, qrSecret);
    expect(a.token).toBe(b.token);
  });

  it("produces different tokens for different sessions, even with the same secret", () => {
    const qrSecret = generateSessionSecret();
    const tokenA = computeCurrentToken("session-a", qrSecret).token;
    const tokenB = computeCurrentToken("session-b", qrSecret).token;
    expect(tokenA).not.toBe(tokenB);
  });

  it("produces different tokens for different secrets, even with the same session id", () => {
    const sessionId = "same-session";
    const tokenA = computeCurrentToken(sessionId, generateSessionSecret()).token;
    const tokenB = computeCurrentToken(sessionId, generateSessionSecret()).token;
    expect(tokenA).not.toBe(tokenB);
  });

  it("never reveals the secret itself in the token", () => {
    const { sessionId, qrSecret } = freshSession();
    const { token } = computeCurrentToken(sessionId, qrSecret);
    expect(token).not.toContain(qrSecret);
  });
});

describe("redeemToken — the core anti-cheating guarantee", () => {
  it("accepts a valid, unused token", async () => {
    const { sessionId, qrSecret } = freshSession();
    const { token } = computeCurrentToken(sessionId, qrSecret);

    const result = await redeemToken(sessionId, qrSecret, token);
    expect(result).toEqual({ ok: true });
  });

  it("rejects a token that doesn't match the current or previous rotation step", async () => {
    const { sessionId, qrSecret } = freshSession();
    const result = await redeemToken(sessionId, qrSecret, "0".repeat(32));
    expect(result).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("rejects a valid token that has already been redeemed once — the actual anti-screenshot guarantee", async () => {
    const { sessionId, qrSecret } = freshSession();
    const { token } = computeCurrentToken(sessionId, qrSecret);

    const first = await redeemToken(sessionId, qrSecret, token);
    const second = await redeemToken(sessionId, qrSecret, token);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: false, reason: "already_used" });
  });

  it("a token from one session cannot be redeemed against a different session", async () => {
    const sessionA = freshSession();
    const sessionB = freshSession();
    const { token } = computeCurrentToken(sessionA.sessionId, sessionA.qrSecret);

    // Even if somehow submitted with sessionB's id, the HMAC won't match
    // sessionB's secret+id combination, so this should be invalid, not
    // merely "wrong session."
    const result = await redeemToken(sessionB.sessionId, sessionB.qrSecret, token);
    expect(result).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("concurrent redemption attempts for the same token: exactly one wins — this is the specific race condition the design doc flags as the actual anti-forwarding mechanism, not the 5-second rotation alone", async () => {
    const { sessionId, qrSecret } = freshSession();
    const { token } = computeCurrentToken(sessionId, qrSecret);

    const CONCURRENT_ATTEMPTS = 25;
    const results = await Promise.all(
      Array.from({ length: CONCURRENT_ATTEMPTS }, () => redeemToken(sessionId, qrSecret, token))
    );

    const successes = results.filter((r) => r.ok);
    const alreadyUsed = results.filter((r) => !r.ok && r.reason === "already_used");

    expect(successes).toHaveLength(1);
    expect(alreadyUsed).toHaveLength(CONCURRENT_ATTEMPTS - 1);
  });

  it("many concurrent redemptions across many different sessions never cross-contaminate each other", async () => {
    const sessions = Array.from({ length: 10 }, () => freshSession());
    const tokens = sessions.map((s) => computeCurrentToken(s.sessionId, s.qrSecret).token);

    // Fire every session's redemption twice, all interleaved — each
    // session should independently see exactly one success.
    const results = await Promise.all(
      sessions.flatMap((s, i) => [
        redeemToken(s.sessionId, s.qrSecret, tokens[i]),
        redeemToken(s.sessionId, s.qrSecret, tokens[i]),
      ])
    );

    const successes = results.filter((r) => r.ok);
    expect(successes).toHaveLength(sessions.length); // exactly one success per session
  });
});

describe("generateSessionSecret", () => {
  it("produces a fresh, sufficiently long random secret each call", () => {
    const a = generateSessionSecret();
    const b = generateSessionSecret();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });
});
