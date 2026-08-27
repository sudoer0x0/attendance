import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";

// Must be set before jwt.ts is imported, since it reads these at module
// scope (via the accessSecret()/refreshSecret() closures, called lazily —
// but set here regardless for clarity and to match every other module's
// expectation that these env vars exist).
process.env.JWT_ACCESS_SECRET = "test-access-secret-not-for-real-use-only-in-tests";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-not-for-real-use-only-in-tests";
process.env.JWT_ACCESS_TTL_MIN = "15";
process.env.JWT_REFRESH_TTL_DAYS = "14";

const { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, isTokenVersionCurrent } =
  await import("../jwt");

const baseClaims = {
  sub: "user_123",
  role: "TEACHER" as const,
  departmentId: "dept_abc",
  tokenVersion: 3,
};

describe("access token sign/verify round-trip", () => {
  it("verifies a freshly signed token and returns the original claims", async () => {
    const token = await signAccessToken(baseClaims);
    const claims = await verifyAccessToken(token);

    expect(claims).not.toBeNull();
    expect(claims?.sub).toBe(baseClaims.sub);
    expect(claims?.role).toBe(baseClaims.role);
    expect(claims?.departmentId).toBe(baseClaims.departmentId);
    expect(claims?.tokenVersion).toBe(baseClaims.tokenVersion);
  });

  it("rejects a token signed with a different secret (e.g. a forged token)", async () => {
    const forged = await new SignJWT({ ...baseClaims })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode("some-attacker-controlled-secret"));

    const claims = await verifyAccessToken(forged);
    expect(claims).toBeNull();
  });

  it("rejects a syntactically invalid token instead of throwing", async () => {
    const claims = await verifyAccessToken("not.a.valid.jwt.at.all");
    expect(claims).toBeNull();
  });

  it("rejects an expired token", async () => {
    const expired = await new SignJWT({ ...baseClaims })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("-1s") // already expired the instant it's issued
      .sign(new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!));

    const claims = await verifyAccessToken(expired);
    expect(claims).toBeNull();
  });

  it("an access token cannot be verified as a refresh token and vice versa (different secrets)", async () => {
    const accessToken = await signAccessToken(baseClaims);
    const refreshToken = await signRefreshToken(baseClaims);

    expect(await verifyRefreshToken(accessToken)).toBeNull();
    expect(await verifyAccessToken(refreshToken)).toBeNull();
  });
});

describe("isTokenVersionCurrent — the kill-switch comparison", () => {
  it("is current when the claim matches the live DB value", () => {
    expect(isTokenVersionCurrent(3, 3)).toBe(true);
  });

  it("is NOT current when the DB value has been bumped since the token was issued — this is what makes deactivation/credential-reset/'log out everywhere' actually work", () => {
    expect(isTokenVersionCurrent(3, 4)).toBe(false);
  });

  it("is NOT current if somehow the claim is ahead of the DB value either (defensive — should never happen, but must not treat this as valid)", () => {
    expect(isTokenVersionCurrent(5, 3)).toBe(false);
  });
});
