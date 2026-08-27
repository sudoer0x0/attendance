import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

process.env.JWT_ACCESS_SECRET = "test-access-secret-not-for-real-use-only-in-tests";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-not-for-real-use-only-in-tests";

const dbMock = {
  superAdmin: { findUnique: vi.fn() },
  departmentAdmin: { findUnique: vi.fn() },
  teacher: { findUnique: vi.fn() },
  student: { findUnique: vi.fn() },
};
vi.mock("@/lib/db", () => ({ db: dbMock }));

const { requireSession, UnauthorizedError, ForbiddenError } = await import("../guard");
const { signAccessToken } = await import("../jwt");

function requestWithCookie(token: string): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    headers: { cookie: `attend_access=${token}` },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireSession", () => {
  it("throws UnauthorizedError when there's no session cookie at all", async () => {
    const req = new NextRequest("http://localhost/api/test");
    await expect(requireSession(req, ["TEACHER"])).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws UnauthorizedError for a garbage/invalid token", async () => {
    const req = requestWithCookie("not-a-real-jwt");
    await expect(requireSession(req, ["TEACHER"])).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws ForbiddenError when the role isn't in the allowed list, even with a perfectly valid token", async () => {
    const token = await signAccessToken({ sub: "t1", role: "TEACHER", tokenVersion: 0 });
    const req = requestWithCookie(token);
    await expect(requireSession(req, ["SUPER_ADMIN"])).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws UnauthorizedError when tokenVersion doesn't match the live DB value — this is the kill-switch actually working end to end", async () => {
    dbMock.teacher.findUnique.mockResolvedValue({ tokenVersion: 5, active: true }); // DB says 5
    const token = await signAccessToken({ sub: "t1", role: "TEACHER", tokenVersion: 3 }); // token claims 3
    const req = requestWithCookie(token);
    await expect(requireSession(req, ["TEACHER"])).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws UnauthorizedError when the account has been deactivated, even with a matching tokenVersion", async () => {
    dbMock.teacher.findUnique.mockResolvedValue({ tokenVersion: 0, active: false }); // deactivated
    const token = await signAccessToken({ sub: "t1", role: "TEACHER", tokenVersion: 0 });
    const req = requestWithCookie(token);
    await expect(requireSession(req, ["TEACHER"])).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws UnauthorizedError when the account no longer exists in the DB", async () => {
    dbMock.teacher.findUnique.mockResolvedValue(null);
    const token = await signAccessToken({ sub: "ghost", role: "TEACHER", tokenVersion: 0 });
    const req = requestWithCookie(token);
    await expect(requireSession(req, ["TEACHER"])).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("succeeds and returns the claims when everything lines up", async () => {
    dbMock.teacher.findUnique.mockResolvedValue({ tokenVersion: 2, active: true });
    const token = await signAccessToken({ sub: "t1", role: "TEACHER", departmentId: "d1", tokenVersion: 2 });
    const req = requestWithCookie(token);

    const claims = await requireSession(req, ["TEACHER"]);
    expect(claims.sub).toBe("t1");
    expect(claims.departmentId).toBe("d1");
  });

  it("Super Admin has no 'active' flag on the model — is not gated by it (only teacher/dept-admin/student are)", async () => {
    dbMock.superAdmin.findUnique.mockResolvedValue({ tokenVersion: 0 });
    const token = await signAccessToken({ sub: "sa1", role: "SUPER_ADMIN", tokenVersion: 0 });
    const req = requestWithCookie(token);

    const claims = await requireSession(req, ["SUPER_ADMIN"]);
    expect(claims.role).toBe("SUPER_ADMIN");
  });
});
