"use client";

import { useEffect, useState, useMemo } from "react";
import { AppShell, PageHeader } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, TableHead, TableBody, TableRow, Th, Td, EmptyState } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/apiFetch";

interface Teacher {
  id: string;
  fullName: string;
  email: string;
  active: boolean;
  mustChangePassword: boolean;
  _count: { courses: number };
}

const navItems = [
  { label: "Students", href: "/admin/students" },
  { label: "Staff", href: "/admin/teachers", active: true },
  { label: "Levels", href: "/admin/levels" },
  { label: "Audit log", href: "/admin/audit" },
];

export default function TeachersPage() {
  const { push } = useToast();
  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "PENDING" | "DEACTIVATED">("ALL");

  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Teacher | null>(null);
  const [credentialsResult, setCredentialsResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  async function load() {
    const res = await apiFetch("/api/teachers");
    if (res.ok) setTeachers(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(teacher: Teacher) {
    const res = await apiFetch(`/api/teachers/${teacher.id}/toggle-active`, { method: "PATCH" });
    if (res.ok) {
      push(`Staff account ${teacher.active ? "deactivated" : "reactivated"}.`, "success");
      load();
    } else {
      push("Could not update staff account.", "danger");
    }
  }

  async function confirmReset() {
    if (!resetTarget) return;
    const res = await apiFetch(`/api/teachers/${resetTarget.id}/reset-credentials`, { method: "PATCH" });
    const data = await res.json();
    if (res.ok) {
      setResetTarget(null);
      setCredentialsResult({ email: resetTarget.email, tempPassword: data.tempPassword });
      load();
    } else {
      push(data.error ?? "Could not reset credentials.", "danger");
    }
  }

  async function unlockStaff(teacher: Teacher) {
    setUnlockingId(teacher.id);
    try {
      const res = await apiFetch("/api/auth/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: teacher.email }),
      });
      const data = await res.json();
      if (res.ok) {
        push(`Login lockout cleared for ${teacher.fullName}.`, "success");
      } else {
        push(data.error ?? "Could not clear lockout.", "danger");
      }
    } finally {
      setUnlockingId(null);
    }
  }

  const filteredTeachers = useMemo(() => {
    if (!teachers) return [];
    return teachers.filter((t) => {
      const matchesSearch =
        !search.trim() ||
        t.fullName.toLowerCase().includes(search.toLowerCase()) ||
        t.email.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && t.active && !t.mustChangePassword) ||
        (statusFilter === "PENDING" && t.active && t.mustChangePassword) ||
        (statusFilter === "DEACTIVATED" && !t.active);

      return matchesSearch && matchesStatus;
    });
  }, [teachers, search, statusFilter]);

  const stats = useMemo(() => {
    if (!teachers) return { total: 0, active: 0, pending: 0, totalCourses: 0 };
    return {
      total: teachers.length,
      active: teachers.filter((t) => t.active && !t.mustChangePassword).length,
      pending: teachers.filter((t) => t.active && t.mustChangePassword).length,
      totalCourses: teachers.reduce((sum, t) => sum + t._count.courses, 0),
    };
  }, [teachers]);

  return (
    <AppShell navItems={navItems} orgLabel="Attend" userLabel="Department Admin">
      <PageHeader
        title="Faculty Staff Management"
        description="Provision accounts, assign permissions, and oversee faculty lecturers"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            Add Staff Member
          </Button>
        }
      />

      <div className="flex flex-col gap-5 px-4 py-5 md:px-8">
        {/* Overview Stats Bar */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-sm">
            <span className="text-[12px] font-medium text-[var(--color-ink-subtle)]">Total Faculty</span>
            <span className="mt-1 font-[var(--font-display)] text-[22px] font-bold text-[var(--color-ink)]">
              {teachers ? stats.total : "—"}
            </span>
          </div>

          <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-sm">
            <span className="text-[12px] font-medium text-[var(--color-ink-subtle)]">Active Lecturers</span>
            <span className="mt-1 font-[var(--font-display)] text-[22px] font-bold text-[var(--color-success-ink)]">
              {teachers ? stats.active : "—"}
            </span>
          </div>

          <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-sm">
            <span className="text-[12px] font-medium text-[var(--color-ink-subtle)]">Pending First Login</span>
            <span className="mt-1 font-[var(--font-display)] text-[22px] font-bold text-[var(--color-warning-ink)]">
              {teachers ? stats.pending : "—"}
            </span>
          </div>

          <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-sm">
            <span className="text-[12px] font-medium text-[var(--color-ink-subtle)]">Supervised Courses</span>
            <span className="mt-1 font-[var(--font-display)] text-[22px] font-bold text-[var(--color-accent-ink)]">
              {teachers ? stats.totalCourses : "—"}
            </span>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Search staff name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white pl-8 pr-3 text-[13px] text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute left-2.5 top-2.5 text-[var(--color-ink-subtle)]"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`rounded px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  statusFilter === "ALL"
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-surface-subtle)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                }`}
              >
                All ({teachers?.length ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("ACTIVE")}
                className={`rounded px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  statusFilter === "ACTIVE"
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-surface-subtle)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                }`}
              >
                Active ({stats.active})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("PENDING")}
                className={`rounded px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  statusFilter === "PENDING"
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-surface-subtle)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                }`}
              >
                Setup Pending ({stats.pending})
              </button>
            </div>
          </div>

          {teachers && (
            <p className="text-[12.5px] text-[var(--color-ink-subtle)]">
              Showing <span className="font-semibold text-[var(--color-ink)]">{filteredTeachers.length}</span> staff member{filteredTeachers.length === 1 ? "" : "s"}
            </p>
          )}
        </div>

        {/* Staff Members List */}
        {teachers === null ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
            <p className="mt-3 text-[13px] text-[var(--color-ink-subtle)]">Loading faculty staff...</p>
          </div>
        ) : teachers.length === 0 ? (
          <EmptyState
            title="No staff members registered"
            description="Create your first lecturer account to allow faculty members to manage courses and host live attendance sessions."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Add First Staff Member
              </Button>
            }
          />
        ) : filteredTeachers.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-8 text-center">
            <p className="text-[14px] font-semibold text-[var(--color-ink)]">No matching staff members</p>
            <p className="mt-1 text-[12.5px] text-[var(--color-ink-subtle)]">
              Try adjusting your search query or status filter.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card Feed (< md) */}
            <div className="flex flex-col gap-3 md:hidden">
              {filteredTeachers.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-[var(--font-display)] text-[15px] font-bold text-[var(--color-ink)]">
                        {t.fullName}
                      </p>
                      <p className="text-[12.5px] text-[var(--color-ink-muted)] break-all">{t.email}</p>
                    </div>
                    <div>
                      {!t.active ? (
                        <Badge tone="danger">Deactivated</Badge>
                      ) : t.mustChangePassword ? (
                        <Badge tone="warning">Setup Pending</Badge>
                      ) : (
                        <Badge tone="success" dot>
                          Active
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--color-border)]/60 pt-2 text-[12px] text-[var(--color-ink-subtle)]">
                    <span>Assigned: <strong className="text-[var(--color-ink)]">{t._count.courses} course{t._count.courses === 1 ? "" : "s"}</strong></span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--color-border)]/60 pt-2.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => unlockStaff(t)}
                      loading={unlockingId === t.id}
                      className="flex-1 text-[12px]"
                      title="Clear 15-minute login lockout delay"
                    >
                      Clear Lockout
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setResetTarget(t)}
                      className="flex-1 text-[12px]"
                    >
                      Reset Pass
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActive(t)}
                      className={`text-[12px] ${t.active ? "text-[var(--color-danger)]" : ""}`}
                    >
                      {t.active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (>= md) */}
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <TableRow>
                    <Th>Lecturer Name</Th>
                    <Th>Email Address</Th>
                    <Th>Courses</Th>
                    <Th>Account Status</Th>
                    <Th className="text-right">Actions</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredTeachers.map((t) => (
                    <TableRow key={t.id}>
                      <Td className="font-medium text-[var(--color-ink)]">{t.fullName}</Td>
                      <Td className="text-[13px] text-[var(--color-ink-muted)]">{t.email}</Td>
                      <Td>
                        <span className="font-semibold text-[var(--color-ink)]">{t._count.courses}</span>{" "}
                        <span className="text-[12px] text-[var(--color-ink-subtle)]">assigned</span>
                      </Td>
                      <Td>
                        {!t.active ? (
                          <Badge tone="danger">Deactivated</Badge>
                        ) : t.mustChangePassword ? (
                          <Badge tone="warning">Setup Pending</Badge>
                        ) : (
                          <Badge tone="success" dot>
                            Active
                          </Badge>
                        )}
                      </Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => unlockStaff(t)}
                            loading={unlockingId === t.id}
                            title="Clear 15-minute login lockout delay"
                          >
                            Clear Lockout
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => setResetTarget(t)}>
                            Reset Pass
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleActive(t)}
                            className={t.active ? "text-[var(--color-danger)]" : ""}
                          >
                            {t.active ? "Deactivate" : "Reactivate"}
                          </Button>
                        </div>
                      </Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      {/* Modal: Create Staff */}
      <CreateStaffModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(result) => {
          setCreateOpen(false);
          setCredentialsResult(result);
          load();
        }}
      />

      {/* Modal: Reset Confirmation */}
      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title="Reset Staff Credentials?"
        description={
          resetTarget
            ? `This will generate a new temporary password for ${resetTarget.fullName} and terminate any active sessions.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button onClick={confirmReset}>
              Reset Credentials
            </Button>
          </>
        }
      >
        {resetTarget && (
          <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)] p-3 text-[13px]">
            <p className="font-semibold text-[var(--color-ink)]">{resetTarget.fullName}</p>
            <p className="text-[12px] text-[var(--color-ink-subtle)]">{resetTarget.email}</p>
          </div>
        )}
      </Modal>

      {/* Modal: Credentials Display Card */}
      <Modal
        open={!!credentialsResult}
        onClose={() => setCredentialsResult(null)}
        title="One-Time Staff Setup Credentials"
        description="Share these temporary login details with the staff member. They will be prompted to create their permanent password upon first login."
        footer={
          <Button onClick={() => setCredentialsResult(null)}>
            I Have Shared Credentials
          </Button>
        }
      >
        {credentialsResult && (
          <div className="flex flex-col gap-3">
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3.5 space-y-2">
              <div>
                <span className="text-[11.5px] font-medium text-[var(--color-ink-subtle)]">Login Email</span>
                <p className="font-[var(--font-mono)] text-[13.5px] font-bold text-[var(--color-ink)]">
                  {credentialsResult.email}
                </p>
              </div>
              <div>
                <span className="text-[11.5px] font-medium text-[var(--color-ink-subtle)]">Temporary Password</span>
                <p className="font-[var(--font-mono)] text-[15px] font-bold text-[var(--color-accent)] tracking-wider">
                  {credentialsResult.tempPassword}
                </p>
              </div>
            </div>
            <p className="text-[11.5px] text-[var(--color-ink-subtle)]">
              These credentials will only be displayed once.
            </p>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}

// Component: Create Staff Modal
function CreateStaffModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (result: { email: string; tempPassword: string }) => void;
}) {
  const { push } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setFullName("");
        setEmail("");
        onCreated({ email: data.email, tempPassword: data.tempPassword });
      } else {
        push(data.error ?? "Could not create staff account.", "danger");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Faculty Staff Member"
      description="Create a lecturer account with course creation and live attendance permissions."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            Create Staff Account
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Input
          label="Full Name *"
          placeholder="e.g. Dr. Jane Okonjo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoFocus
        />
        <Input
          label="Email Address *"
          type="email"
          placeholder="e.g. j.okonjo@university.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint="A temporary password will be generated automatically."
          required
        />
      </form>
    </Modal>
  );
}
