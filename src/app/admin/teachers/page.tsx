"use client";

import { useEffect, useState, useCallback } from "react";
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
  email: string;
  fullName: string;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
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
  const [createOpen, setCreateOpen] = useState(false);
  const [credentialsResult, setCredentialsResult] = useState<{ email: string; temporaryPassword?: string } | null>(null);
  const [resetTarget, setResetTarget] = useState<Teacher | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/teachers");
    if (res.ok) setTeachers(await res.json());
  }, []);

  useEffect(() => {
    // See HANDOFF.md "Known gaps — Frontend data fetching" re: this lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function toggleActive(teacher: Teacher) {
    const res = await apiFetch(`/api/teachers/${teacher.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !teacher.active }),
    });
    if (res.ok) {
      push(teacher.active ? "Staff member deactivated. Their sessions were logged out immediately." : "Staff member reactivated.", "success");
      load();
    } else {
      push("Could not update this staff member.", "danger");
    }
  }

  async function confirmReset() {
    if (!resetTarget) return;
    const res = await apiFetch(`/api/teachers/${resetTarget.id}/reset-credentials`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setResetTarget(null);
      setCredentialsResult({ email: data.email, temporaryPassword: data.temporaryPassword });
      load();
    } else {
      push(data.error ?? "Could not reset credentials.", "danger");
    }
  }

  async function unlockStaff(teacher: Teacher) {
    const res = await apiFetch("/api/auth/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId: teacher.id }),
    });
    if (res.ok) {
      push(`Login lockout cleared for ${teacher.fullName}.`, "success");
    } else {
      const data = await res.json();
      push(data.error ?? "Could not clear lockout.", "danger");
    }
  }

  return (
    <AppShell navItems={navItems} orgLabel="Attend" userLabel="Department Admin">
      <PageHeader
        title="Staff"
        description={teachers ? `${teachers.length} staff members` : undefined}
        actions={<Button onClick={() => setCreateOpen(true)}>Add staff</Button>}
      />

      <div className="px-4 pb-8 pt-4 md:px-6">
        {teachers === null ? (
          <p className="py-10 text-center text-[13px] text-[var(--color-ink-subtle)]">Loading...</p>
        ) : teachers.length === 0 ? (
          <EmptyState
            title="No staff yet"
            description="Add a staff member to give them access to the staff portal."
            action={<Button onClick={() => setCreateOpen(true)}>Add staff</Button>}
          />
        ) : (
          <>
            {/* Mobile Card Feed (shown on < md screens) */}
            <div className="flex flex-col gap-3 md:hidden">
              {teachers.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-[var(--font-display)] text-[15px] font-bold text-[var(--color-ink)]">
                        {t.fullName}
                      </p>
                      <p className="text-[12.5px] text-[var(--color-ink-muted)] break-all">{t.email}</p>
                    </div>
                    <div>
                      {!t.active ? (
                        <Badge tone="danger">Deactivated</Badge>
                      ) : t.mustChangePassword ? (
                        <Badge tone="warning">Setup pending</Badge>
                      ) : (
                        <Badge tone="success" dot>
                          Active
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--color-border)]/60 pt-2 text-[12.5px]">
                    <span className="text-[var(--color-ink-subtle)]">
                      {t._count.courses} {t._count.courses === 1 ? "course" : "courses"} assigned
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--color-border)]/60 pt-2.5">
                    <Button variant="secondary" size="sm" onClick={() => unlockStaff(t)} title="Clear 15-minute login lockout" className="flex-1 text-[12px]">
                      Clear Lockout
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setResetTarget(t)} className="flex-1 text-[12px]">
                      Reset
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

            {/* Desktop Table (hidden on < md screens) */}
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <TableRow>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Courses</Th>
                    <Th>Status</Th>
                    <Th />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {teachers.map((t) => (
                    <TableRow key={t.id}>
                      <Td className="font-medium">{t.fullName}</Td>
                      <Td className="text-[var(--color-ink-muted)]">{t.email}</Td>
                      <Td>{t._count.courses}</Td>
                      <Td>
                        {!t.active ? (
                          <Badge tone="danger">Deactivated</Badge>
                        ) : t.mustChangePassword ? (
                          <Badge tone="warning">Setup pending</Badge>
                        ) : (
                          <Badge tone="success" dot>
                            Active
                          </Badge>
                        )}
                      </Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => unlockStaff(t)} title="Clear 15-minute login lockout">
                            Clear Lockout
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setResetTarget(t)}>
                            Reset
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

      <CreateStaffModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(result) => {
          setCreateOpen(false);
          setCredentialsResult(result);
          load();
        }}
      />

      {/* Reset confirmation — a real action worth an explicit step, since
          it immediately kills the staff member's current session (§10). */}
      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title="Reset credentials?"
        description={
          resetTarget
            ? `${resetTarget.fullName}'s password and authenticator will stop working immediately, and they'll be signed out everywhere. A new temporary password will be generated.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmReset}>
              Reset credentials
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-[var(--color-ink-subtle)]">
          Only do this after verifying it&apos;s really them — e.g. a call or a chat thread you already trust — since
          this is exactly the kind of request someone impersonating them would also make.
        </p>
      </Modal>

      {/* Shown exactly once, per the "shown once, never again" pattern used
          for department creation. */}
      <Modal
        open={!!credentialsResult}
        onClose={() => setCredentialsResult(null)}
        title="New temporary credentials"
        description="Share these with the staff member securely — they won't be shown again."
        footer={<Button onClick={() => setCredentialsResult(null)}>Done</Button>}
      >
        {credentialsResult && (
          <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3 font-[var(--font-mono)] text-[13px]">
            <p>Email: {credentialsResult.email}</p>
            {credentialsResult.temporaryPassword ? (
              <p>Temporary password: {credentialsResult.temporaryPassword}</p>
            ) : (
              <p>A temporary password was emailed to them.</p>
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}

function CreateStaffModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (r: { email: string; temporaryPassword?: string }) => void;
}) {
  const { push } = useToast();
  const [form, setForm] = useState({ fullName: "", email: "" });
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        onCreated({ email: data.email, temporaryPassword: data.temporaryPassword });
        setForm({ fullName: "", email: "" });
      } else {
        push(data.error ?? "Could not create staff member.", "danger");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add staff member"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={loading}>
            Add staff
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input label="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
    </Modal>
  );
}
