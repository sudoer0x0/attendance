"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
  createdAt?: string;
}

interface DeletedStudent {
  id: string;
  matricNo: string;
  surname: string;
  firstName: string;
  deletedAt: string;
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
    if (search.trim()) params.set("search", search.trim());
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
    const t = setTimeout(loadStudents, 250);
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

  const levelStats = useMemo(() => {
    if (!students) return [];
    const counts: Record<string, number> = {};
    for (const s of students) {
      counts[s.level.name] = (counts[s.level.name] || 0) + 1;
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [students]);

  return (
    <AppShell navItems={navItems} orgLabel="Attend" userLabel="Department Admin">
      <PageHeader
        title="Student Roster"
        description="Manage enrolled students, academic levels, and excel imports"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a href="/api/students/export" download>
              <Button variant="secondary" size="sm" title="Export entire roster to CSV">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export CSV
              </Button>
            </a>
            <Button variant="secondary" size="sm" onClick={() => setBinOpen(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
              Recycle Bin
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Import Excel
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              Add Student
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-5 px-4 py-5 md:px-8">
        {/* Overview Stats Row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-sm">
            <span className="text-[12px] font-medium text-[var(--color-ink-subtle)]">Active Enrolled</span>
            <span className="mt-1 font-[var(--font-display)] text-[22px] font-bold text-[var(--color-ink)]">
              {students ? students.length : "—"}
            </span>
          </div>

          <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-sm">
            <span className="text-[12px] font-medium text-[var(--color-ink-subtle)]">Academic Levels</span>
            <span className="mt-1 font-[var(--font-display)] text-[22px] font-bold text-[var(--color-accent-ink)]">
              {levels.length}
            </span>
          </div>

          <div className="col-span-2 flex flex-col justify-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-sm">
            <span className="text-[12px] font-medium text-[var(--color-ink-subtle)]">Enrolled Breakdown</span>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {levelStats.length === 0 ? (
                <span className="text-[12px] text-[var(--color-ink-subtle)]">No students enrolled yet</span>
              ) : (
                levelStats.map((st) => (
                  <span
                    key={st.name}
                    className="rounded bg-[var(--color-surface-subtle)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--color-ink)]"
                  >
                    {st.name}: <strong className="text-[var(--color-accent)]">{st.count}</strong>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Search & Level Filter Toolbar */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Search by student name or matric..."
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

            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-[13px] text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
            >
              <option value="">All Academic Levels</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} Level
                </option>
              ))}
            </select>
          </div>

          {students && (
            <p className="text-[12.5px] text-[var(--color-ink-subtle)]">
              Showing <span className="font-semibold text-[var(--color-ink)]">{students.length}</span> student{students.length === 1 ? "" : "s"}
            </p>
          )}
        </div>

        {/* Student Roster View */}
        {students === null ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
            <p className="mt-3 text-[13px] text-[var(--color-ink-subtle)]">Loading students...</p>
          </div>
        ) : students.length === 0 ? (
          <EmptyState
            title="No students found"
            description={search || levelFilter ? "No students match your active filters." : "Enroll students manually or import your roster from an Excel/CSV spreadsheet."}
            action={
              <div className="flex gap-2">
                {(search || levelFilter) && (
                  <Button variant="secondary" size="sm" onClick={() => { setSearch(""); setLevelFilter(""); }}>
                    Clear Filters
                  </Button>
                )}
                <Button size="sm" onClick={() => setImportOpen(true)}>
                  Import Excel
                </Button>
              </div>
            }
          />
        ) : (
          <>
            {/* Mobile Card Feed (< md) */}
            <div className="flex flex-col gap-2.5 md:hidden">
              {students.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col gap-2.5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-[var(--font-display)] text-[15px] font-bold text-[var(--color-ink)]">
                        {s.surname}, {s.firstName} {s.middleName || ""}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-[var(--font-mono)] text-[12.5px] font-medium text-[var(--color-accent)]">
                          {s.matricNo}
                        </span>
                        <Badge>{s.level.name} Level</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)]/60 pt-2.5">
                    <Button variant="secondary" size="sm" onClick={() => setEditTarget(s)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(s.id)}
                      className="text-[var(--color-danger)]"
                    >
                      Remove
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
                    <Th>Student Name</Th>
                    <Th>Matric Number</Th>
                    <Th>Academic Level</Th>
                    <Th className="text-right">Actions</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {students.map((s) => (
                    <TableRow key={s.id}>
                      <Td className="font-medium text-[var(--color-ink)]">
                        {s.surname}, {s.firstName} {s.middleName ? `(${s.middleName})` : ""}
                      </Td>
                      <Td className="font-[var(--font-mono)] text-[13px] font-semibold text-[var(--color-accent)]">
                        {s.matricNo}
                      </Td>
                      <Td>
                        <Badge>{s.level.name} Level</Badge>
                      </Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="secondary" size="sm" onClick={() => setEditTarget(s)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(s.id)}
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
          </>
        )}
      </div>

      {/* Modal: Add Student */}
      <AddStudentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        levels={levels}
        onComplete={() => {
          setAddOpen(false);
          loadStudents();
        }}
      />

      {/* Modal: Edit Student */}
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

      {/* Modal: Import Excel */}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        levels={levels}
        onComplete={() => {
          setImportOpen(false);
          loadStudents();
        }}
      />

      {/* Modal: Recycle Bin */}
      <RecycleBinModal
        open={binOpen}
        onClose={() => setBinOpen(false)}
        onRestored={loadStudents}
      />
    </AppShell>
  );
}

// Component: Add Student Modal
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
  const [form, setForm] = useState({
    matricNo: "",
    surname: "",
    firstName: "",
    middleName: "",
    levelId: "",
    dob: "",
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.matricNo.trim() || !form.surname.trim() || !form.firstName.trim() || !form.levelId || !form.dob) {
      push("Please fill in all required fields.", "danger");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricNo: form.matricNo.trim().toUpperCase(),
          surname: form.surname.trim(),
          firstName: form.firstName.trim(),
          middleName: form.middleName.trim() || null,
          levelId: form.levelId,
          dob: form.dob,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        push("Student enrolled successfully.", "success");
        setForm({ matricNo: "", surname: "", firstName: "", middleName: "", levelId: "", dob: "" });
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
      title="Enroll New Student"
      description="Add a student record to your departmental database."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            Enroll Student
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Input
          label="Matriculation Number *"
          placeholder="e.g. U23CYS1074"
          value={form.matricNo}
          onChange={(e) => setForm({ ...form, matricNo: e.target.value.toUpperCase() })}
          required
          autoFocus
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Surname *"
            placeholder="e.g. Adebayo"
            value={form.surname}
            onChange={(e) => setForm({ ...form, surname: e.target.value })}
            required
          />
          <Input
            label="First Name *"
            placeholder="e.g. Emmanuel"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
          />
        </div>
        <Input
          label="Middle Name (Optional)"
          placeholder="e.g. Oluwaseun"
          value={form.middleName}
          onChange={(e) => setForm({ ...form, middleName: e.target.value })}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[var(--color-ink)]">
              Academic Level *
            </label>
            <select
              value={form.levelId}
              onChange={(e) => setForm({ ...form, levelId: e.target.value })}
              className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-[13px] text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
              required
            >
              <option value="">Select level...</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} Level
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Date of Birth *"
            type="date"
            value={form.dob}
            onChange={(e) => setForm({ ...form, dob: e.target.value })}
            hint="Used for first-time account setup verification."
            required
          />
        </div>
      </form>
    </Modal>
  );
}

// Component: Edit Student Modal
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
    levelId: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (student) {
      setForm({
        surname: student.surname,
        firstName: student.firstName,
        middleName: student.middleName ?? "",
        levelId: student.level.id,
      });
    }
  }, [student]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!student || !form.surname.trim() || !form.firstName.trim() || !form.levelId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surname: form.surname.trim(),
          firstName: form.firstName.trim(),
          middleName: form.middleName.trim() || null,
          levelId: form.levelId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        push("Student profile updated.", "success");
        onComplete();
      } else {
        push(data.error ?? "Could not update student.", "danger");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Student Record"
      description={student ? `Matric Number: ${student.matricNo}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            Save Changes
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Surname *"
            value={form.surname}
            onChange={(e) => setForm({ ...form, surname: e.target.value })}
            required
          />
          <Input
            label="First Name *"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
          />
        </div>
        <Input
          label="Middle Name"
          value={form.middleName}
          onChange={(e) => setForm({ ...form, middleName: e.target.value })}
        />
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[var(--color-ink)]">
            Academic Level *
          </label>
          <select
            value={form.levelId}
            onChange={(e) => setForm({ ...form, levelId: e.target.value })}
            className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-[13px] text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
            required
          >
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} Level
              </option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  );
}

// Component: Excel / CSV Importer Modal
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
  const [file, setFile] = useState<File | null>(null);
  const [levelId, setLevelId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors?: string[] } | null>(null);

  async function handleImport() {
    if (!file || !levelId) {
      push("Please select a file and an academic level.", "danger");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("levelId", levelId);

      const res = await apiFetch("/api/students/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        push(`Successfully imported ${data.imported} student records.`, "success");
      } else {
        push(data.error ?? "Failed to process import.", "danger");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setFile(null);
    setLevelId("");
    setResult(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import Student Roster"
      description="Upload an Excel (.xlsx, .xls) or CSV spreadsheet of student records."
      footer={
        result ? (
          <Button onClick={() => { handleClose(); onComplete(); }}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleImport} loading={loading} disabled={!file || !levelId}>
              Start Import
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[var(--color-ink)]">
            Assign to Academic Level *
          </label>
          <select
            value={levelId}
            onChange={(e) => setLevelId(e.target.value)}
            className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-[13px] text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
            required
          >
            <option value="">Select destination level...</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} Level
              </option>
            ))}
          </select>
        </div>

        {/* Drag and Drop Box */}
        <label className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-6 text-center cursor-pointer hover:border-[var(--color-accent)]">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-accent)]">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="mt-2 text-[13.5px] font-semibold text-[var(--color-ink)]">
            {file ? file.name : "Click to choose spreadsheet file"}
          </p>
          <p className="mt-0.5 text-[11.5px] text-[var(--color-ink-subtle)]">
            Supported columns: Matric Number, Surname, First Name, Middle Name, DOB (YYYY-MM-DD)
          </p>
        </label>

        {result && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-success)]/40 bg-[var(--color-success-subtle)] p-3.5 text-[13px]">
            <p className="font-bold text-[var(--color-success-ink)]">
              Import Completed: {result.imported} student(s) enrolled
            </p>
            {result.errors && result.errors.length > 0 && (
              <div className="mt-2 text-[12px] text-[var(--color-danger)]">
                <p className="font-semibold">Skipped rows:</p>
                <ul className="list-disc pl-4 mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                  {result.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// Component: Recycle Bin Modal
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
  const [deletedStudents, setDeletedStudents] = useState<DeletedStudent[] | null>(null);
  const [search, setSearch] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadBin = useCallback(async () => {
    const res = await apiFetch("/api/students/recycle-bin");
    if (res.ok) setDeletedStudents(await res.json());
  }, []);

  useEffect(() => {
    if (open) loadBin();
  }, [open, loadBin]);

  async function handleRestore(id: string) {
    setRestoringId(id);
    try {
      const res = await apiFetch(`/api/students/${id}/restore`, { method: "POST" });
      if (res.ok) {
        push("Student restored to active roster.", "success");
        loadBin();
        onRestored();
      } else {
        push("Could not restore student.", "danger");
      }
    } finally {
      setRestoringId(null);
    }
  }

  const filtered = useMemo(() => {
    if (!deletedStudents) return [];
    if (!search.trim()) return deletedStudents;
    const q = search.toLowerCase();
    return deletedStudents.filter(
      (s) => s.matricNo.toLowerCase().includes(q) || s.surname.toLowerCase().includes(q) || s.firstName.toLowerCase().includes(q)
    );
  }, [deletedStudents, search]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Student Recycle Bin"
      description="Soft-deleted students can be restored back to the active roster at any time."
      size="lg"
      footer={
        <Button onClick={onClose}>
          Close Bin
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Filter removed students..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8.5 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-xs text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
        />

        {deletedStudents === null ? (
          <p className="py-8 text-center text-[13px] text-[var(--color-ink-subtle)]">Loading recycle bin...</p>
        ) : deletedStudents.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[var(--color-ink-subtle)]">
            Recycle bin is empty.
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-[var(--color-ink-subtle)]">
            No matching removed students for &quot;{search}&quot;.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
            <Table>
              <TableHead>
                <TableRow>
                  <Th>Student</Th>
                  <Th>Matric No.</Th>
                  <Th>Level</Th>
                  <Th className="text-right">Action</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <Td className="font-medium text-[var(--color-ink)]">
                      {s.surname}, {s.firstName}
                    </Td>
                    <Td className="font-[var(--font-mono)] text-[12.5px] text-[var(--color-ink)]">{s.matricNo}</Td>
                    <Td><Badge>{s.level.name}</Badge></Td>
                    <Td className="text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleRestore(s.id)}
                        loading={restoringId === s.id}
                      >
                        Restore
                      </Button>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Modal>
  );
}
