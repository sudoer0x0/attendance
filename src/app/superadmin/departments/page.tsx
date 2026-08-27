"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell, PageHeader } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Table, TableHead, TableBody, TableRow, Th, Td, EmptyState } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/apiFetch";

interface DepartmentAdminSummary {
  id: string;
  email: string;
  fullName: string;
  active: boolean;
  mustChangePassword: boolean;
}

interface Department {
  id: string;
  name: string;
  code: string;
  deletedAt?: string | null;
  _count: { students: number; teachers: number };
  admins: DepartmentAdminSummary[];
}

interface StudentSummary {
  id: string;
  matricNo: string;
  surname: string;
  firstName: string;
  middleName?: string | null;
  active: boolean;
  passwordHash?: string | null;
  currentDeviceId?: string | null;
  level: { id: string; name: string };
}

interface StaffSummary {
  id: string;
  email: string;
  fullName: string;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  _count: { courses: number };
}

interface LevelSummary {
  id: string;
  name: string;
  _count: { students: number };
}

const navItems = [
  { label: "Departments", href: "/superadmin/departments", active: true },
  { label: "Audit log", href: "/superadmin/audit" },
  { label: "Settings", href: "/superadmin/settings" },
];

export default function DepartmentsPage() {
  const { push } = useToast();
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [created, setCreated] = useState<{ adminEmail: string; temporaryPassword?: string } | null>(null);
  const [resetTarget, setResetTarget] = useState<DepartmentAdminSummary | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; temporaryPassword?: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/departments");
    if (res.ok) setDepartments(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleAdminActive(admin: DepartmentAdminSummary) {
    const res = await apiFetch(`/api/department-admins/${admin.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !admin.active }),
    });
    if (res.ok) {
      push(admin.active ? "Admin deactivated. Their sessions were logged out immediately." : "Admin reactivated.", "success");
      load();
    } else {
      push("Could not update this admin.", "danger");
    }
  }

  async function confirmReset() {
    if (!resetTarget) return;
    const res = await apiFetch(`/api/department-admins/${resetTarget.id}/reset-credentials`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setResetTarget(null);
      setResetResult({ email: data.email, temporaryPassword: data.temporaryPassword });
      load();
    } else {
      push(data.error ?? "Could not reset credentials.", "danger");
    }
  }

  async function executeDelete(permanent: boolean) {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const url = `/api/departments/${deleteTarget.id}${permanent ? "?permanent=true" : ""}`;
      const res = await apiFetch(url, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        push(
          permanent
            ? "Department and all associated records deleted permanently."
            : "Department moved to recycle bin (retained for 30 days).",
          "success"
        );
        setDeleteTarget(null);
        load();
      } else {
        push(data.error ?? "Could not delete department.", "danger");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell navItems={navItems} orgLabel="Attend" userLabel="Super Admin">
      <PageHeader
        title="Departments"
        description={departments ? `${departments.length} active departments` : undefined}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setRecycleBinOpen(true)}>
              Recycle bin
            </Button>
            <Button onClick={() => setCreateOpen(true)}>New department</Button>
          </div>
        }
      />

      <div className="px-4 py-5 md:px-6">
        {departments === null ? (
          <p className="py-10 text-center text-[13px] text-[var(--color-ink-subtle)]">Loading...</p>
        ) : departments.length === 0 ? (
          <EmptyState
            title="No departments yet"
            description="Create your first department to generate its admin credentials."
            action={<Button onClick={() => setCreateOpen(true)}>New department</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((d) => (
              <Card key={d.id} className="flex flex-col justify-between">
                <CardBody>
                  <div>
                    <p className="font-[var(--font-display)] text-[15px] font-bold text-[var(--color-ink)]">
                      {d.name}
                    </p>
                    <p className="mt-0.5 font-[var(--font-mono)] text-[12px] text-[var(--color-ink-subtle)]">
                      {d.code}
                    </p>
                  </div>

                  <div className="mt-3 flex gap-4 text-[12.5px] text-[var(--color-ink-muted)]">
                    <span className="font-medium">{d._count.students} students</span>
                    <span className="font-medium">{d._count.teachers} staff</span>
                  </div>

                  {d.admins.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
                      <p className="text-[11.5px] font-semibold text-[var(--color-ink-subtle)] uppercase tracking-wider">
                        Admins
                      </p>
                      {d.admins.map((admin) => (
                        <div key={admin.id} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-medium text-[var(--color-ink)]">{admin.fullName}</p>
                            <div className="mt-0.5">
                              {!admin.active ? (
                                <Badge tone="danger">Deactivated</Badge>
                              ) : admin.mustChangePassword ? (
                                <Badge tone="warning">Setup pending</Badge>
                              ) : (
                                <Badge tone="success" dot>
                                  Active
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setResetTarget(admin)}>
                              Reset
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleAdminActive(admin)}
                              className={admin.active ? "text-[var(--color-danger)]" : ""}
                            >
                              {admin.active ? "Deactivate" : "Reactivate"}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>

                <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3 bg-[var(--color-surface-subtle)]/50">
                  <Button variant="secondary" size="sm" onClick={() => setSelectedDept(d)}>
                    Manage roster &amp; staff &rarr;
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(d)}
                    className="text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)]"
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateDepartmentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(result) => {
          setCreateOpen(false);
          setCreated(result);
          load();
        }}
      />

      <DepartmentRecycleBinModal
        open={recycleBinOpen}
        onClose={() => setRecycleBinOpen(false)}
        onChanged={() => load()}
      />

      {/* Department Inspector Modal */}
      {selectedDept && (
        <DepartmentDetailsModal
          dept={selectedDept}
          open={!!selectedDept}
          onClose={() => {
            setSelectedDept(null);
            load();
          }}
          onChanged={() => load()}
        />
      )}

      {/* Delete Department Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={`Delete department: ${deleteTarget?.name ?? ""}`}
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              loading={deleting}
              onClick={() => executeDelete(false)}
              className="text-[var(--color-warning-ink)]"
            >
              Move to recycle bin
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              onClick={() => executeDelete(true)}
            >
              Delete permanently
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 text-[13px] text-[var(--color-ink-subtle)]">
          <p>
            Choose how you would like to delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.code}):
          </p>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
            <p className="font-semibold text-[var(--color-ink)]">1. Move to recycle bin (Recommended)</p>
            <p className="mt-0.5 text-[12.5px]">
              The department is hidden and its admins are logged out. You can restore it anytime within 30 days before it is permanently purged.
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/30 bg-[var(--color-danger-subtle)] p-3 text-[var(--color-danger)]">
            <p className="font-semibold">2. Delete permanently</p>
            <p className="mt-0.5 text-[12.5px]">
              Irreversibly deletes this department and all associated staff, courses, levels, students, and attendance records immediately.
            </p>
          </div>
        </div>
      </Modal>

      {/* Shown exactly once */}
      <Modal
        open={!!created}
        onClose={() => setCreated(null)}
        title="Department created"
        description="Share these credentials with the department admin securely — they won't be shown again."
        footer={<Button onClick={() => setCreated(null)}>Done</Button>}
      >
        {created && (
          <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3 font-[var(--font-mono)] text-[13px]">
            <p>Email: {created.adminEmail}</p>
            {created.temporaryPassword ? (
              <p>Temporary password: {created.temporaryPassword}</p>
            ) : (
              <p>A temporary password was emailed to them.</p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title="Reset credentials?"
        description={
          resetTarget
            ? `${resetTarget.fullName}'s password and authenticator will stop working immediately, and they'll be signed out everywhere.`
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
          Only do this after verifying it&apos;s really them through a channel you already trust — this is exactly
          the kind of request someone impersonating them would also make.
        </p>
      </Modal>

      <Modal
        open={!!resetResult}
        onClose={() => setResetResult(null)}
        title="New temporary credentials"
        description="Share these with the admin securely — they won't be shown again."
        footer={<Button onClick={() => setResetResult(null)}>Done</Button>}
      >
        {resetResult && (
          <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3 font-[var(--font-mono)] text-[13px]">
            <p>Email: {resetResult.email}</p>
            {resetResult.temporaryPassword ? (
              <p>Temporary password: {resetResult.temporaryPassword}</p>
            ) : (
              <p>A new temporary password was emailed to them.</p>
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}

function DepartmentDetailsModal({
  dept,
  open,
  onClose,
  onChanged,
}: {
  dept: Department;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { push } = useToast();
  const [tab, setTab] = useState<"students" | "staff" | "levels">("students");
  const [students, setStudents] = useState<StudentSummary[] | null>(null);
  const [staff, setStaff] = useState<StaffSummary[] | null>(null);
  const [levels, setLevels] = useState<LevelSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modals for actions
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [editStudentTarget, setEditStudentTarget] = useState<StudentSummary | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [staffCredentials, setStaffCredentials] = useState<{ email: string; temporaryPassword?: string } | null>(null);
  const [resetStaffTarget, setResetStaffTarget] = useState<StaffSummary | null>(null);

  const [addLevelOpen, setAddLevelOpen] = useState(false);
  const [editLevelTarget, setEditLevelTarget] = useState<LevelSummary | null>(null);
  const [promoteLevelTarget, setPromoteLevelTarget] = useState<LevelSummary | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t, l] = await Promise.all([
        apiFetch(`/api/students?departmentId=${dept.id}`).then((r) => (r.ok ? r.json() : [])),
        apiFetch(`/api/teachers?departmentId=${dept.id}`).then((r) => (r.ok ? r.json() : [])),
        apiFetch(`/api/levels?departmentId=${dept.id}`).then((r) => (r.ok ? r.json() : [])),
      ]);
      setStudents(s);
      setStaff(t);
      setLevels(l);
    } finally {
      setLoading(false);
    }
  }, [dept.id]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  async function handleDeleteStudent(id: string) {
    const res = await apiFetch(`/api/students/${id}`, { method: "DELETE" });
    if (res.ok) {
      push("Student moved to recycle bin.", "success");
      loadData();
      onChanged();
    } else {
      push("Could not remove student.", "danger");
    }
  }

  async function toggleStaffActive(s: StaffSummary) {
    const res = await apiFetch(`/api/teachers/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !s.active }),
    });
    if (res.ok) {
      push(s.active ? "Staff deactivated. Sessions revoked." : "Staff reactivated.", "success");
      loadData();
      onChanged();
    } else {
      push("Could not update staff member.", "danger");
    }
  }

  async function confirmStaffReset() {
    if (!resetStaffTarget) return;
    const res = await apiFetch(`/api/teachers/${resetStaffTarget.id}/reset-credentials`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setResetStaffTarget(null);
      setStaffCredentials({ email: data.email, temporaryPassword: data.temporaryPassword });
      loadData();
      onChanged();
    } else {
      push(data.error ?? "Could not reset credentials.", "danger");
    }
  }

  async function unlockStaff(s: StaffSummary) {
    const res = await apiFetch("/api/auth/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId: s.id }),
    });
    if (res.ok) {
      push(`Login lockout cleared for ${s.fullName}.`, "success");
    } else {
      const data = await res.json();
      push(data.error ?? "Could not clear lockout.", "danger");
    }
  }

  async function handleDeleteLevel(id: string) {
    const res = await apiFetch(`/api/levels/${id}`, { method: "DELETE" });
    if (res.ok) {
      push("Level removed.", "success");
      loadData();
      onChanged();
    } else {
      const data = await res.json();
      push(data.error ?? "Could not remove level.", "danger");
    }
  }

  const filteredStudents = (students ?? []).filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.surname.toLowerCase().includes(q) ||
      s.firstName.toLowerCase().includes(q) ||
      s.matricNo.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={`${dept.name} (${dept.code})`}
        description="Department Administration & Roster Management"
        footer={<Button onClick={onClose}>Close</Button>}
      >
        <div className="flex flex-col gap-4">
          {/* Tab switcher */}
          <div className="flex border-b border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => setTab("students")}
              className={`border-b-2 px-4 py-2 text-[13px] font-medium transition-colors ${
                tab === "students"
                  ? "border-[var(--color-accent)] text-[var(--color-accent)] font-semibold"
                  : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              Students ({students?.length ?? dept._count.students})
            </button>
            <button
              type="button"
              onClick={() => setTab("staff")}
              className={`border-b-2 px-4 py-2 text-[13px] font-medium transition-colors ${
                tab === "staff"
                  ? "border-[var(--color-accent)] text-[var(--color-accent)] font-semibold"
                  : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              Staff ({staff?.length ?? dept._count.teachers})
            </button>
            <button
              type="button"
              onClick={() => setTab("levels")}
              className={`border-b-2 px-4 py-2 text-[13px] font-medium transition-colors ${
                tab === "levels"
                  ? "border-[var(--color-accent)] text-[var(--color-accent)] font-semibold"
                  : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              Levels ({levels?.length ?? 0})
            </button>
          </div>

          {loading ? (
            <p className="py-8 text-center text-[13px] text-[var(--color-ink-subtle)]">Loading department data...</p>
          ) : tab === "students" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Input
                  placeholder="Search by name or matric no."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full sm:w-64"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
                    Import Excel
                  </Button>
                  <Button size="sm" onClick={() => setAddStudentOpen(true)}>
                    Enroll student
                  </Button>
                </div>
              </div>

              {filteredStudents.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-[var(--color-ink-subtle)]">
                  {search ? "No students match your search." : "No students enrolled in this department yet."}
                </p>
              ) : (
                <div className="max-h-[50vh] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <Th>Student</Th>
                        <Th>Matric No.</Th>
                        <Th>Level</Th>
                        <Th>Passkey</Th>
                        <Th />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredStudents.map((s) => (
                        <TableRow key={s.id}>
                          <Td className="font-medium">{s.surname}, {s.firstName}</Td>
                          <Td className="font-[var(--font-mono)] text-[12.5px] text-[var(--color-ink-muted)]">{s.matricNo}</Td>
                          <Td><Badge>{s.level?.name ?? "—"}</Badge></Td>
                          <Td>
                            {s.currentDeviceId ? (
                              <Badge tone="success" dot>Bound</Badge>
                            ) : (
                              <Badge tone="warning">Pending</Badge>
                            )}
                          </Td>
                          <Td className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditStudentTarget(s)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteStudent(s.id)}
                                className="text-[var(--color-danger)]"
                              >
                                Remove
                              </Button>
                            </div>
                          </Td>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : tab === "staff" ? (
            <div className="flex flex-col gap-3">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setAddStaffOpen(true)}>
                  Add staff
                </Button>
              </div>

              {!staff || staff.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-[var(--color-ink-subtle)]">
                  No staff members enrolled in this department yet.
                </p>
              ) : (
                <div className="max-h-[50vh] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
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
                      {staff.map((t) => (
                        <TableRow key={t.id}>
                          <Td className="font-medium">{t.fullName}</Td>
                          <Td className="text-[var(--color-ink-muted)]">{t.email}</Td>
                          <Td>{t._count?.courses ?? 0} courses</Td>
                          <Td>
                            {!t.active ? (
                              <Badge tone="danger">Deactivated</Badge>
                            ) : t.mustChangePassword ? (
                              <Badge tone="warning">Setup pending</Badge>
                            ) : (
                              <Badge tone="success" dot>Active</Badge>
                            )}
                          </Td>
                          <Td className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => unlockStaff(t)} title="Clear 15-minute login lockout">
                                Clear Lockout
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setResetStaffTarget(t)}>
                                Reset
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleStaffActive(t)}
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
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setAddLevelOpen(true)}>
                  Add level
                </Button>
              </div>

              {!levels || levels.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-[var(--color-ink-subtle)]">
                  No levels configured for this department yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {levels.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3"
                    >
                      <div>
                        <p className="font-semibold text-[14px] text-[var(--color-ink)]">{l.name} Level</p>
                        <p className="text-[12px] text-[var(--color-ink-subtle)]">{l._count.students} students</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setEditLevelTarget(l)}>
                          Edit
                        </Button>
                        {l._count.students > 0 && (
                          <Button size="sm" variant="secondary" onClick={() => setPromoteLevelTarget(l)}>
                            Promote &rarr;
                          </Button>
                        )}
                        {l._count.students === 0 && (
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteLevel(l.id)} className="text-[var(--color-danger)]">
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Enroll Single Student */}
      <SuperAdminAddStudentModal
        open={addStudentOpen}
        onClose={() => setAddStudentOpen(false)}
        departmentId={dept.id}
        levels={levels ?? []}
        onComplete={() => {
          setAddStudentOpen(false);
          loadData();
          onChanged();
        }}
      />

      {/* Modal: Edit Student */}
      <SuperAdminEditStudentModal
        student={editStudentTarget}
        open={!!editStudentTarget}
        onClose={() => setEditStudentTarget(null)}
        levels={levels ?? []}
        onComplete={() => {
          setEditStudentTarget(null);
          loadData();
          onChanged();
        }}
      />

      {/* Modal: Bulk Import Excel */}
      <SuperAdminImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        departmentId={dept.id}
        levels={levels ?? []}
        onComplete={() => {
          setImportOpen(false);
          loadData();
          onChanged();
        }}
      />

      {/* Modal: Add Staff Member */}
      <SuperAdminAddStaffModal
        open={addStaffOpen}
        onClose={() => setAddStaffOpen(false)}
        departmentId={dept.id}
        onCreated={(result) => {
          setAddStaffOpen(false);
          setStaffCredentials(result);
          loadData();
          onChanged();
        }}
      />

      {/* Modal: Add Level */}
      <SuperAdminAddLevelModal
        open={addLevelOpen}
        onClose={() => setAddLevelOpen(false)}
        departmentId={dept.id}
        onCreated={() => {
          setAddLevelOpen(false);
          loadData();
          onChanged();
        }}
      />

      {/* Modal: Edit Level */}
      <SuperAdminEditLevelModal
        level={editLevelTarget}
        open={!!editLevelTarget}
        onClose={() => setEditLevelTarget(null)}
        onUpdated={() => {
          setEditLevelTarget(null);
          loadData();
          onChanged();
        }}
      />

      {/* Modal: Promote Level Students */}
      <SuperAdminPromoteLevelModal
        sourceLevel={promoteLevelTarget}
        levels={levels ?? []}
        open={!!promoteLevelTarget}
        onClose={() => setPromoteLevelTarget(null)}
        onPromoted={() => {
          setPromoteLevelTarget(null);
          loadData();
          onChanged();
        }}
      />

      {/* Reset Staff Confirmation */}
      <Modal
        open={!!resetStaffTarget}
        onClose={() => setResetStaffTarget(null)}
        title="Reset staff credentials?"
        description={
          resetStaffTarget
            ? `${resetStaffTarget.fullName}'s password and authenticator will stop working immediately, and they'll be signed out everywhere.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetStaffTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmStaffReset}>
              Reset credentials
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-[var(--color-ink-subtle)]">
          Only do this after verifying it&apos;s really them — e.g. a call or a chat thread you already trust.
        </p>
      </Modal>

      {/* Staff Temporary Credentials Modal */}
      <Modal
        open={!!staffCredentials}
        onClose={() => setStaffCredentials(null)}
        title="New temporary credentials"
        description="Share these with the staff member securely — they won't be shown again."
        footer={<Button onClick={() => setStaffCredentials(null)}>Done</Button>}
      >
        {staffCredentials && (
          <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3 font-[var(--font-mono)] text-[13px]">
            <p>Email: {staffCredentials.email}</p>
            {staffCredentials.temporaryPassword ? (
              <p>Temporary password: {staffCredentials.temporaryPassword}</p>
            ) : (
              <p>A temporary password was emailed to them.</p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

function SuperAdminAddStudentModal({
  open,
  onClose,
  departmentId,
  levels,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  departmentId: string;
  levels: LevelSummary[];
  onComplete: () => void;
}) {
  const { push } = useToast();
  const [form, setForm] = useState({ matricNo: "", surname: "", firstName: "", middleName: "", dateOfBirth: "", levelId: "" });
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!form.surname.trim() || !form.firstName.trim() || !form.matricNo.trim() || !form.dateOfBirth || !form.levelId) {
      push("All required fields must be filled.", "danger");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, departmentId }),
      });
      const data = await res.json();
      if (res.ok) {
        push("Student enrolled successfully.", "success");
        setForm({ matricNo: "", surname: "", firstName: "", middleName: "", dateOfBirth: "", levelId: "" });
        onComplete();
      } else {
        push(data.error ?? "Could not enroll student.", "danger");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enroll new student"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={loading}>
            Enroll student
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input label="Surname *" value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
        <Input label="First name *" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        <Input label="Middle name (optional)" value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} />
        <Input label="Matric number *" placeholder="e.g. U23CYS1001" value={form.matricNo} onChange={(e) => setForm({ ...form, matricNo: e.target.value })} />
        <Input label="Date of birth *" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[var(--color-ink)]">Academic Level *</label>
          <select
            value={form.levelId}
            onChange={(e) => setForm({ ...form, levelId: e.target.value })}
            className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
          >
            <option value="">Select level</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>{l.name} Level</option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}

function SuperAdminEditStudentModal({
  student,
  open,
  onClose,
  levels,
  onComplete,
}: {
  student: StudentSummary | null;
  open: boolean;
  onClose: () => void;
  levels: LevelSummary[];
  onComplete: () => void;
}) {
  const { push } = useToast();
  const [form, setForm] = useState({ surname: "", firstName: "", middleName: "", matricNo: "", levelId: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (student) {
      setForm({
        surname: student.surname,
        firstName: student.firstName,
        middleName: student.middleName ?? "",
        matricNo: student.matricNo,
        levelId: student.level?.id ?? "",
      });
    }
  }, [student]);

  async function submit() {
    if (!student) return;
    if (!form.surname.trim() || !form.firstName.trim() || !form.matricNo.trim() || !form.levelId) {
      push("Surname, first name, matric number, and level are required.", "danger");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        push("Student updated successfully.", "success");
        onComplete();
      } else {
        push(data.error ?? "Could not update student.", "danger");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlock() {
    if (!student) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unlock: true }),
      });
      if (res.ok) {
        push("Student account unlocked and login lockout cleared.", "success");
        onComplete();
      } else {
        const data = await res.json();
        push(data.error ?? "Could not unlock student.", "danger");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!student) return;
    if (!confirm("Are you sure you want to reset this student's password? They will be able to perform first-time setup again with their Date of Birth.")) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetPassword: true, unlock: true }),
      });
      if (res.ok) {
        push("Student password reset. They can now set a new password on their first login.", "success");
        onComplete();
      } else {
        const data = await res.json();
        push(data.error ?? "Could not reset student password.", "danger");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit student details & level"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={loading}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input label="Surname *" value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
        <Input label="First name *" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        <Input label="Middle name" value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} />
        <Input label="Matric number *" value={form.matricNo} onChange={(e) => setForm({ ...form, matricNo: e.target.value })} />
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[var(--color-ink)]">Academic Level *</label>
          <select
            value={form.levelId}
            onChange={(e) => setForm({ ...form, levelId: e.target.value })}
            className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
          >
            <option value="">Select level</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>{l.name} Level</option>
            ))}
          </select>
        </div>

        <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
          <p className="text-[12px] font-medium text-[var(--color-ink)]">Account Access &amp; Security</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--color-ink-subtle)]">
            Clear temporary login lockouts or reset the password so the student can set up their account again.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" type="button" onClick={handleUnlock} disabled={loading}>
              Clear Lockout / Unlock
            </Button>
            <Button variant="secondary" size="sm" type="button" onClick={handleResetPassword} disabled={loading} className="text-[var(--color-warning-ink)]">
              Reset Password Setup
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function SuperAdminImportModal({
  open,
  onClose,
  departmentId,
  levels,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  departmentId: string;
  levels: LevelSummary[];
  onComplete: () => void;
}) {
  const { push } = useToast();
  const [levelId, setLevelId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ newCount: number; duplicateCount: number; malformedCount: number } | null>(null);
  const [loading, setLoading] = useState(false);

  async function runPreview() {
    if (!file || !levelId) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch(`/api/students/import?mode=preview&levelId=${levelId}&departmentId=${departmentId}`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (res.ok) setPreview(data);
      else push(data.error ?? "Could not read this file.", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    if (!file || !levelId) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch(`/api/students/import?mode=commit&levelId=${levelId}&departmentId=${departmentId}`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (res.ok) {
        push(`Imported ${data.created} students.`, "success");
        setPreview(null);
        setFile(null);
        onComplete();
      } else {
        push(data.error ?? "Import failed.", "danger");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import students from Excel"
      description="Columns expected: Surname, First Name, Middle Name, Matric No, Date of Birth."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {preview ? (
            <Button onClick={commit} loading={loading}>
              Confirm import
            </Button>
          ) : (
            <Button onClick={runPreview} loading={loading} disabled={!file || !levelId}>
              Preview
            </Button>
          )}
        </>
      }
    >
      {levels.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] p-3 text-[13px] text-[var(--color-warning-ink)]">
          Please add at least one level to this department first.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--color-ink)]">Level</label>
            <select
              value={levelId}
              onChange={(e) => setLevelId(e.target.value)}
              className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
            >
              <option value="">Select a level</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} Level
                </option>
              ))}
            </select>
          </div>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
            }}
            className="text-[13px]"
          />
          {preview && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3 text-[13px]">
              <p>
                <strong>{preview.newCount}</strong> new, <strong>{preview.duplicateCount}</strong> duplicates
                skipped, <strong>{preview.malformedCount}</strong> malformed rows skipped.
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function SuperAdminAddStaffModal({
  open,
  onClose,
  departmentId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  departmentId: string;
  onCreated: (r: { email: string; temporaryPassword?: string }) => void;
}) {
  const { push } = useToast();
  const [form, setForm] = useState({ fullName: "", email: "" });
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!form.fullName.trim() || !form.email.trim()) {
      push("Full name and email are required.", "danger");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, departmentId }),
      });
      const data = await res.json();
      if (res.ok) {
        onCreated({ email: data.email, temporaryPassword: data.temporaryPassword });
        setForm({ fullName: "", email: "" });
      } else {
        push(data.error ?? "Could not add staff member.", "danger");
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

function SuperAdminAddLevelModal({
  open,
  onClose,
  departmentId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  departmentId: string;
  onCreated: () => void;
}) {
  const { push } = useToast();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim()) {
      push("Level name is required.", "danger");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, departmentId }),
      });
      const data = await res.json();
      if (res.ok) {
        push("Level added successfully.", "success");
        setName("");
        onCreated();
      } else {
        push(data.error ?? "Could not add level.", "danger");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add academic level"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={loading}>
            Add level
          </Button>
        </>
      }
    >
      <Input label="Level name" placeholder="e.g. 100, 200, 300, ND1, HND2" value={name} onChange={(e) => setName(e.target.value)} />
    </Modal>
  );
}

function SuperAdminEditLevelModal({
  level,
  open,
  onClose,
  onUpdated,
}: {
  level: LevelSummary | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { push } = useToast();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (level) setName(level.name);
  }, [level]);

  async function submit() {
    if (!level || !name.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/levels/${level.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        push("Level updated.", "success");
        onUpdated();
      } else {
        push(data.error ?? "Could not update level.", "danger");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit level name"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={loading}>
            Save changes
          </Button>
        </>
      }
    >
      <Input label="Level name" value={name} onChange={(e) => setName(e.target.value)} />
    </Modal>
  );
}

function SuperAdminPromoteLevelModal({
  sourceLevel,
  levels,
  open,
  onClose,
  onPromoted,
}: {
  sourceLevel: LevelSummary | null;
  levels: LevelSummary[];
  open: boolean;
  onClose: () => void;
  onPromoted: () => void;
}) {
  const { push } = useToast();
  const [targetLevelId, setTargetLevelId] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!sourceLevel || !targetLevelId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/levels/${sourceLevel.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLevelId }),
      });
      const data = await res.json();
      if (res.ok) {
        push(`Moved ${data.count} students to the new level.`, "success");
        setTargetLevelId("");
        onPromoted();
      } else {
        push(data.error ?? "Could not promote students.", "danger");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Promote ${sourceLevel?.name ?? ""} Level students`}
      description={`Move all ${sourceLevel?._count.students ?? 0} students from ${sourceLevel?.name ?? ""} Level to the next level.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={loading} disabled={!targetLevelId}>
            Promote students
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="text-[13px] font-medium text-[var(--color-ink)]">Target Level</label>
        <select
          value={targetLevelId}
          onChange={(e) => setTargetLevelId(e.target.value)}
          className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
        >
          <option value="">Select target level</option>
          {levels
            .filter((l) => l.id !== sourceLevel?.id)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} Level ({l._count.students} students)
              </option>
            ))}
        </select>
      </div>
    </Modal>
  );
}

function CreateDepartmentModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (r: { adminEmail: string; temporaryPassword?: string }) => void;
}) {
  const { push } = useToast();
  const [form, setForm] = useState({ name: "", code: "", adminEmail: "", adminFullName: "" });
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!form.name.trim() || !form.code.trim() || !form.adminEmail.trim() || !form.adminFullName.trim()) {
      push("All fields are required.", "danger");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        onCreated({ adminEmail: data.adminEmail, temporaryPassword: data.temporaryPassword });
        setForm({ name: "", code: "", adminEmail: "", adminFullName: "" });
      } else {
        push(data.error ?? "Could not create department.", "danger");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New department"
      description="This also creates the department's first admin account."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={loading}>
            Create
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input label="Department name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Short code" placeholder="e.g. CSC" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <Input
          label="Admin full name"
          value={form.adminFullName}
          onChange={(e) => setForm({ ...form, adminFullName: e.target.value })}
        />
        <Input
          label="Admin email"
          type="email"
          value={form.adminEmail}
          onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
        />
      </div>
    </Modal>
  );
}

function DepartmentRecycleBinModal({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { push } = useToast();
  const [deleted, setDeleted] = useState<Department[] | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDeleted = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/departments/recycle-bin");
      if (res.ok) setDeleted(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadDeleted();
    }
  }, [open, loadDeleted]);

  async function restore(id: string) {
    const res = await apiFetch(`/api/departments/${id}/restore`, { method: "POST" });
    if (res.ok) {
      push("Department restored.", "success");
      loadDeleted();
      onChanged();
    } else {
      push("Could not restore department.", "danger");
    }
  }

  async function purgePermanently(id: string, name: string) {
    if (!confirm(`Are you sure you want to permanently delete "${name}"? This cannot be undone.`)) {
      return;
    }
    const res = await apiFetch(`/api/departments/${id}?permanent=true`, { method: "DELETE" });
    if (res.ok) {
      push("Department permanently deleted.", "success");
      loadDeleted();
      onChanged();
    } else {
      push("Could not permanently delete department.", "danger");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Department Recycle Bin"
      description="Departments here will be automatically purged after 30 days."
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {loading && !deleted ? (
        <p className="py-6 text-center text-[13px] text-[var(--color-ink-subtle)]">Loading...</p>
      ) : !deleted || deleted.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-[var(--color-ink-subtle)]">Recycle bin is empty.</p>
      ) : (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {deleted.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3.5"
            >
              <div>
                <p className="font-medium text-[13.5px] text-[var(--color-ink)]">{d.name} ({d.code})</p>
                <p className="text-[12px] text-[var(--color-ink-subtle)]">
                  Deleted {d.deletedAt ? new Date(d.deletedAt).toLocaleDateString() : ""} &bull; {d._count?.students ?? 0} students, {d._count?.teachers ?? 0} staff
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => restore(d.id)}>
                  Restore
                </Button>
                <Button size="sm" variant="danger" onClick={() => purgePermanently(d.id, d.name)}>
                  Delete permanently
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
