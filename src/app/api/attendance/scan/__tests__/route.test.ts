import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

process.env.JWT_ACCESS_SECRET = "test-access-secret-not-for-real-use-only-in-tests";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-not-for-real-use-only-in-tests";
process.env.QR_ROTATION_SECONDS = "3600"; // long window, avoid rotation-boundary flakiness

vi.mock("@/lib/redis", async () => {
  const { FakeRedis } = await import("@/test-utils/fake-redis");
  return { redis: new FakeRedis() };
});

const dbMock = {
  student: { findUnique: vi.fn() },
  session: { findUnique: vi.fn() },
  attendance: { create: vi.fn() },
  auditLog: { create: vi.fn() },
};
vi.mock("@/lib/db", () => ({ db: dbMock }));

const { POST } = await import("../route");
const { signAccessToken } = await import("@/lib/auth/jwt");
const { computeCurrentToken, generateSessionSecret } = await import("@/lib/qr/token");

const STUDENT = { id: "s1", active: true, currentDeviceId: "cred-abc", tokenVersion: 0 };

/** Unique session per test — the mocked redis instance is shared across
 *  the whole file, so reusing one session/token across tests would leak
 *  "already used" state between them. Same fix as token.test.ts's
 *  freshSession() helper, applied here for the same reason. */
function freshSession() {
  return { id: `session-${crypto.randomUUID()}`, status: "ACTIVE" as const, qrSecret: generateSessionSecret() };
}

function scanRequest(cookieToken: string, body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/attendance/scan", {
    method: "POST",
    headers: { cookie: `attend_access=${cookieToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.student.findUnique.mockResolvedValue(STUDENT);
  dbMock.attendance.create.mockResolvedValue({ timestamp: new Date() });
  dbMock.auditLog.create.mockResolvedValue({});
});

async function studentToken() {
  return signAccessToken({
    sub: STUDENT.id,
    role: "STUDENT",
    tokenVersion: STUDENT.tokenVersion,
    deviceId: STUDENT.currentDeviceId,
  });
}

describe("POST /api/attendance/scan", () => {
  it("401s with no session cookie", async () => {
    const session = freshSession();
    dbMock.session.findUnique.mockResolvedValue(session);
    const res = await POST(scanRequest("", { sessionId: session.id, token: "x".repeat(32) }));
    expect(res.status).toBe(401);
  });

  it("records attendance for a valid, unused token", async () => {
    const session = freshSession();
    dbMock.session.findUnique.mockResolvedValue(session);
    const token = await studentToken();
    const { token: qrToken } = computeCurrentToken(session.id, session.qrSecret);

    const res = await POST(scanRequest(token, { sessionId: session.id, token: qrToken }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(dbMock.attendance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sessionId: session.id, studentId: STUDENT.id, method: "QR" }),
    });
  });

  it("rejects a second scan of the same token — the actual anti-screenshot behavior, exercised through the real route", async () => {
    const session = freshSession();
    dbMock.session.findUnique.mockResolvedValue(session);
    const token = await studentToken();
    const { token: qrToken } = computeCurrentToken(session.id, session.qrSecret);

    const first = await POST(scanRequest(token, { sessionId: session.id, token: qrToken }));
    const second = await POST(scanRequest(token, { sessionId: session.id, token: qrToken }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    const secondBody = await second.json();
    expect(secondBody.error).toMatch(/already been used/);
  });

  it("rejects when the session isn't active", async () => {
    const session = freshSession();
    dbMock.session.findUnique.mockResolvedValue({ ...session, status: "ENDED" });
    const token = await studentToken();
    const { token: qrToken } = computeCurrentToken(session.id, session.qrSecret);

    const res = await POST(scanRequest(token, { sessionId: session.id, token: qrToken }));
    expect(res.status).toBe(409);
  });

  it("rejects when the student account is deactivated, even with an otherwise-valid session", async () => {
    const session = freshSession();
    dbMock.session.findUnique.mockResolvedValue(session);
    dbMock.student.findUnique.mockResolvedValue({ ...STUDENT, active: false });
    const token = await studentToken();
    const { token: qrToken } = computeCurrentToken(session.id, session.qrSecret);

    const res = await POST(scanRequest(token, { sessionId: session.id, token: qrToken }));
    expect(res.status).toBe(401);
  });

  it("rejects when the token's signed deviceId doesn't match the student's current device (e.g. device was re-registered since this token was issued)", async () => {
    const session = freshSession();
    dbMock.session.findUnique.mockResolvedValue(session);
    const token = await signAccessToken({
      sub: STUDENT.id,
      role: "STUDENT",
      tokenVersion: STUDENT.tokenVersion,
      deviceId: "some-old-revoked-device-id",
    });
    const { token: qrToken } = computeCurrentToken(session.id, session.qrSecret);

    const res = await POST(scanRequest(token, { sessionId: session.id, token: qrToken }));
    expect(res.status).toBe(403);
  });

  it("rejects a malformed body", async () => {
    const session = freshSession();
    dbMock.session.findUnique.mockResolvedValue(session);
    const token = await studentToken();
    const res = await POST(scanRequest(token, { sessionId: session.id }));
    expect(res.status).toBe(400);
  });

  it("a token computed for a different session is rejected as invalid", async () => {
    const session = freshSession();
    dbMock.session.findUnique.mockResolvedValue(session);
    const token = await studentToken();
    const otherSecret = generateSessionSecret();
    const { token: wrongToken } = computeCurrentToken("other-session", otherSecret);

    const res = await POST(scanRequest(token, { sessionId: session.id, token: wrongToken }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/invalid or has expired/);
  });

  it("gracefully returns ok:alreadyMarked instead of 500 if the DB unique constraint fires (concurrent double-insert)", async () => {
    const session = freshSession();
    dbMock.session.findUnique.mockResolvedValue(session);
    dbMock.attendance.create.mockRejectedValue(new Error("Unique constraint failed"));
    const token = await studentToken();
    const { token: qrToken } = computeCurrentToken(session.id, session.qrSecret);

    const res = await POST(scanRequest(token, { sessionId: session.id, token: qrToken }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.alreadyMarked).toBe(true);
  });
});
