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

interface Level {
  id: string;
  name: string;
}
interface Student {
  id: string;
  matricNo: string;
  surname: string;
  firstName: string;
  middleName?: string | null;
  level: Level;
}

const navItems = [
  { label: "Students", href: "/admin/students", active: true },
  { label: "Staff", href: "/admin/teachers" },
  { label: "Levels", href: "/admin/levels" },
  { label: "Audit log", href: "/admin/audit" },
];

export default function StudentsPage() {
  const { push } = useToast();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [binOpen, setBinOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Student | null>(null);

  const loadStudents = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (levelFilter) params.set("levelId", levelFilter);
    const res = await apiFetch(`/api/students?${params}`);
    if (res.ok) setStudents(await res.json());
  }, [search, levelFilter]);

  useEffect(() => {
    apiFetch("/api/levels")
      .then((r) => r.json())
      .then(setLevels)
      .catch(() => setLevels([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(loadStudents, 250); // debounce search typing
    return () => clearTimeout(t);
  }, [loadStudents]);

  async function handleDelete(id: string) {
    const res = await apiFetch(`/api/students/${id}`, { method: "DELETE" });
    if (res.ok) {
      push("Student moved to recycle bin.", "success");
      loadStudents();
    } else {
      push("Could not remove this student.", "danger");
    }
  }

  return (
    <AppShell navItems={navItems} orgLabel="Attend" userLabel="Department Admin">
      <PageHeader
        title="Students"
        description={students ? `${students.length} students` : undefined}
        actions={
          <>
            <Button variant="secondary" onClick={() => setBinOpen(true)}>
              Recycle bin
            </Button>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              Import Excel
            </Button>
            <Button onClick={() => setAddOpen(true)}>Add student</Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 px-4 py-3 md:px-6">
        <Input
          placeholder="Search by name or matric no."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white px-3 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
        >
          <option value="">All levels</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} level
            </option>
          ))}
        </select>
      </div>

      <div className="px-4 pb-8 md:px-6">
        {students === null ? (
          <p className="py-10 text-center text-[13px] text-[var(--color-ink-subtle)]">Loading...</p>
        ) : students.length === 0 ? (
          <EmptyState
            title="No students yet"
            description="Add students manually or import your roster from an Excel sheet."
            action={<Button onClick={() => setImportOpen(true)}>Import Excel</Button>}
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <Th>Name</Th>
                <Th>Matric No.</Th>
                <Th>Level</Th>
                <Th />
              </TableRow>
            </TableHead>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.id}>
                  <Td className="font-medium">
                    {s.surname}, {s.firstName}
                  </Td>
                  <Td className="font-[var(--font-mono)] text-[12.5px] text-[var(--color-ink-muted)]">
                    {s.matricNo}
                  </Td>
                  <Td>
                    <Badge>{s.level.name}</Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditTarget(s)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)} className="text-[var(--color-danger)]">
                        Remove
                      </Button>
                    </div>
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <EditStudentModal
        student={editTarget}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        levels={levels}
        onComplete={() => {
          setEditTarget(null);
          loadStudents();
        }}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        levels={levels}
        onComplete={() => {
          setImportOpen(false);
          loadStudents();
        }}
      />
      <AddStudentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        levels={levels}
        onComplete={() => {
          setAddOpen(false);
          loadStudents();
        }}
      />
      <RecycleBinModal
        open={binOpen}
        onClose={() => setBinOpen(false)}
        onRestored={loadStudents}
      />
    </AppShell>
  );
}

function ImportModal({
  open,
  onClose,
  levels,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  levels: Level[];
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
      const res = await apiFetch(`/api/students/import?mode=preview&levelId=${levelId}`, {
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
      const res = await apiFetch(`/api/students/import?mode=commit&levelId=${levelId}`, {
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
        <div className="rounded-[var(--radius-md)] border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] p-3 text-[13px] text-[var(--color-warning-ink)]">
          <p className="font-medium">No levels configured yet</p>
          <p className="mt-1">
            Before importing students, your department needs at least one level. Go to the{" "}
            <a href="/admin/levels" className="font-bold underline">
              Levels tab
            </a>{" "}
            to add one (e.g. &quot;100&quot;, &quot;ND1&quot;).
          </p>
        </div>
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
                  {l.name}
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

function AddStudentModal({
  open,
  onClose,
  levels,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  levels: Level[];
  onComplete: () => void;
}) {
  const { push } = useToast();
  const [form, setForm] = useState({ matricNo: "", surname: "", firstName: "", middleName: "", dateOfBirth: "", levelId: "" });
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!form.surname.trim()) {
      push("Surname is required.", "danger");
      return;
    }
    if (!form.firstName.trim()) {
      push("First name is required.", "danger");
      return;
    }
    if (!form.matricNo.trim()) {
      push("Matric number is required.", "danger");
      return;
    }
    if (!form.dateOfBirth) {
      push("Date of birth is required.", "danger");
      return;
    }
    if (!form.levelId) {
      push("Please select a level.", "danger");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        push("Student added.", "success");
        setForm({ matricNo: "", surname: "", firstName: "", middleName: "", dateOfBirth: "", levelId: "" });
        onComplete();
      } else {
        push(data.error ?? "Could not add student.", "danger");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add student"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={loading} disabled={levels.length === 0}>
            Add student
          </Button>
        </>
      }
    >
      {levels.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] p-3 text-[13px] text-[var(--color-warning-ink)]">
          <p className="font-medium">No levels configured yet</p>
          <p className="mt-1">
            Before you can add students, your department needs at least one level. Go to the{" "}
            <a href="/admin/levels" className="font-bold underline">
              Levels tab
            </a>{" "}
            to add one (e.g. &quot;100&quot;, &quot;ND1&quot;, &quot;Year 1&quot;).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Input label="Surname" required value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
          <Input label="First name" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <Input label="Middle name" value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} />
          <Input label="Matric no." required value={form.matricNo} onChange={(e) => setForm({ ...form, matricNo: e.target.value })} />
          <Input
            label="Date of birth"
            type="date"
            required
            value={form.dateOfBirth}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--color-ink)]">
              Level <span className="text-[var(--color-danger)]">*</span>
            </label>
            <select
              value={form.levelId}
              required
              onChange={(e) => setForm({ ...form, levelId: e.target.value })}
              className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
            >
              <option value="">Select a level</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </Modal>
  );
}

function RecycleBinModal({
  open,
  onClose,
  onRestored,
}: {
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
}) {
  const { push } = useToast();
  const [deleted, setDeleted] = useState<(Student & { deletedAt: string })[] | null>(null);

  useEffect(() => {
    if (!open) return;
    apiFetch("/api/students/recycle-bin")
      .then((res) => res.json())
      .then(setDeleted)
      .catch(() => setDeleted([]));
  }, [open]);

  async function restore(id: string) {
    const res = await apiFetch(`/api/students/${id}/restore`, { method: "POST" });
    if (res.ok) {
      push("Student restored.", "success");
      setDeleted((prev) => prev?.filter((s) => s.id !== id) ?? null);
      onRestored();
    } else {
      push("Could not restore this student.", "danger");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Recycle bin" description="Removed students, kept for 30 days before permanent deletion." size="lg" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {deleted === null ? (
        <p className="py-6 text-center text-[13px] text-[var(--color-ink-subtle)]">Loading...</p>
      ) : deleted.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-[var(--color-ink-subtle)]">Nothing in the recycle bin.</p>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          <Table>
            <TableHead>
              <TableRow>
                <Th>Name</Th>
                <Th>Matric No.</Th>
                <Th>Removed</Th>
                <Th />
              </TableRow>
            </TableHead>
            <TableBody>
              {deleted.map((s) => (
                <TableRow key={s.id}>
                  <Td>{s.surname}, {s.firstName}</Td>
                  <Td className="font-[var(--font-mono)] text-[12.5px]">{s.matricNo}</Td>
                  <Td className="text-[var(--color-ink-subtle)]">{new Date(s.deletedAt).toLocaleDateString()}</Td>
                  <Td className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => restore(s.id)}>
                      Restore
                    </Button>
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Modal>
  );
}

function EditStudentModal({
  student,
  open,
  onClose,
  levels,
  onComplete,
}: {
  student: Student | null;
  open: boolean;
  onClose: () => void;
  levels: Level[];
  onComplete: () => void;
}) {
  const { push } = useToast();
  const [form, setForm] = useState({
    surname: "",
    firstName: "",
    middleName: "",
    matricNo: "",
    levelId: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (student) {
      setForm({
        surname: student.surname,
        firstName: student.firstName,
        middleName: student.middleName ?? "",
        matricNo: student.matricNo,
        levelId: student.level.id,
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
              <option key={l.id} value={l.id}>
                {l.name} Level
              </option>
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
