import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  teacher: { update: vi.fn(), findUnique: vi.fn() },
  departmentAdmin: { update: vi.fn(), findUnique: vi.fn() },
};
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/redis", () => ({ redis: { del: vi.fn().mockResolvedValue(1) } }));

const {
  setTeacherActive,
  setDepartmentAdminActive,
  resetTeacherCredentials,
  resetDepartmentAdminCredentials,
} = await import("../account-actions");

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.teacher.findUnique.mockResolvedValue({ id: "t1", email: "test@example.com" });
  dbMock.departmentAdmin.findUnique.mockResolvedValue({ id: "d1", email: "admin@example.com" });
  dbMock.teacher.update.mockResolvedValue({});
  dbMock.departmentAdmin.update.mockResolvedValue({});
});

describe("setTeacherActive / setDepartmentAdminActive", () => {
  it("deactivating a teacher bumps tokenVersion — this is the actual kill-switch, not just the active flag", async () => {
    await setTeacherActive("t1", false);
    expect(dbMock.teacher.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { active: false, tokenVersion: { increment: 1 } },
    });
  });

  it("reactivating ALSO bumps tokenVersion (not just deactivating) — any active-flag change invalidates old sessions", async () => {
    await setTeacherActive("t1", true);
    expect(dbMock.teacher.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { active: true, tokenVersion: { increment: 1 } },
    });
  });

  it("same behavior for department admins", async () => {
    await setDepartmentAdminActive("d1", false);
    expect(dbMock.departmentAdmin.update).toHaveBeenCalledWith({
      where: { id: "d1" },
      data: { active: false, tokenVersion: { increment: 1 } },
    });
  });
});

describe("resetTeacherCredentials / resetDepartmentAdminCredentials", () => {
  it("returns a non-empty temporary password, not the empty-string bug from an earlier session", async () => {
    // See account-actions.ts's own comment: an earlier version cleared
    // passwordHash to "" directly, which permanently locked the account
    // out (staff-login checks password before mustChangePassword). This
    // test exists specifically to catch a regression back to that bug.
    const password = await resetTeacherCredentials("t1");
    expect(password).toBeTruthy();
    expect(password.length).toBeGreaterThan(5);
  });

  it("clears TOTP and forces mustChangePassword, and bumps tokenVersion", async () => {
    await resetTeacherCredentials("t1");
    const call = dbMock.teacher.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "t1" });
    expect(call.data.totpSecretEncrypted).toBeNull();
    expect(call.data.totpEnrolledAt).toBeNull();
    expect(call.data.mustChangePassword).toBe(true);
    expect(call.data.tokenVersion).toEqual({ increment: 1 });
    expect(typeof call.data.passwordHash).toBe("string");
    expect(call.data.passwordHash.length).toBeGreaterThan(0);
  });

  it("department admin reset does the same, on the departmentAdmin table", async () => {
    const password = await resetDepartmentAdminCredentials("d1");
    expect(password).toBeTruthy();
    const call = dbMock.departmentAdmin.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "d1" });
    expect(call.data.mustChangePassword).toBe(true);
  });

  it("two resets in a row produce different temporary passwords", async () => {
    const a = await resetTeacherCredentials("t1");
    const b = await resetTeacherCredentials("t1");
    expect(a).not.toBe(b);
  });
});
