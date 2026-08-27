"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { AppShell, PageHeader } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/apiFetch";

interface Level {
  id: string;
  name: string;
  _count: { students: number };
}

const navItems = [
  { label: "Students", href: "/admin/students" },
  { label: "Staff", href: "/admin/teachers" },
  { label: "Levels", href: "/admin/levels", active: true },
  { label: "Audit log", href: "/admin/audit" },
];

export default function LevelsPage() {
  const { push } = useToast();
  const [levels, setLevels] = useState<Level[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newLevelName, setNewLevelName] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Level | null>(null);

  // Edit level
  const [editTarget, setEditTarget] = useState<Level | null>(null);
  const [editName, setEditName] = useState("");

  // Promote students
  const [promoteTarget, setPromoteTarget] = useState<Level | null>(null);
  const [promoteToLevelId, setPromoteToLevelId] = useState("");

  const load = useCallback(async () => {
    const res = await apiFetch("/api/levels");
    if (res.ok) setLevels(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createLevel() {
    if (!newLevelName.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newLevelName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        push("Academic level added successfully.", "success");
        setCreateOpen(false);
        setNewLevelName("");
        load();
      } else {
        push(data.error ?? "Could not add level.", "danger");
      }
    } finally {
      setLoading(false);
    }
  }

  async function updateLevel() {
    if (!editTarget || !editName.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/levels/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        push("Level updated.", "success");
        setEditTarget(null);
        load();
      } else {
        push(data.error ?? "Could not update level.", "danger");
      }
    } finally {
      setLoading(false);
    }
  }

  async function executePromote() {
    if (!promoteTarget || !promoteToLevelId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/levels/${promoteTarget.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLevelId: promoteToLevelId }),
      });
      const data = await res.json();
      if (res.ok) {
        push(`Successfully moved ${data.count} students to target level.`, "success");
        setPromoteTarget(null);
        setPromoteToLevelId("");
        load();
      } else {
        push(data.error ?? "Could not promote students.", "danger");
      }
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const res = await apiFetch(`/api/levels/${deleteTarget.id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      push("Level removed.", "success");
      setDeleteTarget(null);
      load();
    } else {
      push(data.error ?? "Could not remove this level.", "danger");
    }
  }

  const totalStudents = useMemo(() => {
    if (!levels) return 0;
    return levels.reduce((sum, l) => sum + l._count.students, 0);
  }, [levels]);

  const largestLevel = useMemo(() => {
    if (!levels || levels.length === 0) return null;
    return [...levels].sort((a, b) => b._count.students - a._count.students)[0];
  }, [levels]);

  return (
    <AppShell navItems={navItems} orgLabel="Attend" userLabel="Department Admin">
      <PageHeader
        title="Academic Levels & Progression"
        description="Configure class levels and advance students as they complete each academic year"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            Add Academic Level
          </Button>
        }
      />

      <div className="flex flex-col gap-5 px-4 py-5 md:px-8">
        {/* Overview Stats Bar */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-sm">
            <span className="text-[12px] font-medium text-[var(--color-ink-subtle)]">Academic Levels</span>
            <span className="mt-1 font-[var(--font-display)] text-[22px] font-bold text-[var(--color-ink)]">
              {levels ? levels.length : "—"}
            </span>
          </div>

          <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-sm">
            <span className="text-[12px] font-medium text-[var(--color-ink-subtle)]">Total Enrolled Students</span>
            <span className="mt-1 font-[var(--font-display)] text-[22px] font-bold text-[var(--color-accent-ink)]">
              {levels ? totalStudents : "—"}
            </span>
          </div>

          <div className="col-span-2 flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-sm sm:col-span-1">
            <span className="text-[12px] font-medium text-[var(--color-ink-subtle)]">Largest Enrollment</span>
            <span className="mt-1 font-[var(--font-display)] text-[20px] font-bold text-[var(--color-ink)] truncate">
              {largestLevel ? `${largestLevel.name} (${largestLevel._count.students})` : "—"}
            </span>
          </div>
        </div>

        {/* Levels Grid */}
        {levels === null ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
            <p className="mt-3 text-[13px] text-[var(--color-ink-subtle)]">Loading academic levels...</p>
          </div>
        ) : levels.length === 0 ? (
          <EmptyState
            title="No academic levels created yet"
            description="Create class tiers (e.g. 100, 200, ND1, HND1) to organize students and take attendance."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Add First Level
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {levels.map((l) => {
              const share = totalStudents > 0 ? Math.round((l._count.students / totalStudents) * 100) : 0;
              return (
                <Card key={l.id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
                  <CardBody className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="rounded bg-[var(--color-accent-subtle)] px-2 py-0.5 font-[var(--font-mono)] text-[12px] font-bold text-[var(--color-accent-ink)]">
                          Level Code
                        </span>
                        <h3 className="mt-2 font-[var(--font-display)] text-[18px] font-bold text-[var(--color-ink)]">
                          {l.name} Level
                        </h3>
                      </div>
                      <span className="font-[var(--font-mono)] text-[20px] font-bold text-[var(--color-ink)]">
                        {l._count.students}
                      </span>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-[11.5px] text-[var(--color-ink-subtle)] pb-1">
                        <span>Enrollment Share</span>
                        <span>{share}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[var(--color-surface-subtle)] overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-accent)] rounded-full transition-all"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </div>
                  </CardBody>

                  <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-[var(--color-border)] bg-[var(--color-surface-subtle)]/50 px-4 py-3">
                    <div className="flex gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditTarget(l);
                          setEditName(l.name);
                        }}
                      >
                        Edit Name
                      </Button>
                      {l._count.students > 0 && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setPromoteTarget(l);
                            setPromoteToLevelId("");
                          }}
                        >
                          Promote Students &rarr;
                        </Button>
                      )}
                    </div>
                    {l._count.students === 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(l)}
                        className="text-[var(--color-danger)]"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Add Level */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Academic Level"
        description="Create a new student class level for your department."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createLevel} loading={loading} disabled={!newLevelName.trim()}>
              Add Level
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); createLevel(); }}>
          <Input
            label="Level Name *"
            placeholder='e.g. "100", "ND1", "Year 3", "Final Year"'
            value={newLevelName}
            onChange={(e) => setNewLevelName(e.target.value)}
            hint="Custom level designation for your department structure."
            required
            autoFocus
          />
        </form>
      </Modal>

      {/* Modal: Edit Level */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Academic Level"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button onClick={updateLevel} loading={loading} disabled={!editName.trim()}>
              Save Changes
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); updateLevel(); }}>
          <Input
            label="Level Name *"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            autoFocus
          />
        </form>
      </Modal>

      {/* Modal: Bulk Promote Students Wizard */}
      <Modal
        open={!!promoteTarget}
        onClose={() => setPromoteTarget(null)}
        title={`Advance ${promoteTarget?.name ?? ""} Level Students`}
        description={`Move all ${promoteTarget?._count.students ?? 0} students currently in ${promoteTarget?.name ?? ""} Level to a new level.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPromoteTarget(null)}>
              Cancel
            </Button>
            <Button onClick={executePromote} loading={loading} disabled={!promoteToLevelId}>
              Confirm Promotion
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="text-[13px] font-medium text-[var(--color-ink)]">
            Select Destination Academic Level *
          </label>
          <select
            value={promoteToLevelId}
            onChange={(e) => setPromoteToLevelId(e.target.value)}
            className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-[13px] text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
          >
            <option value="">Select target level...</option>
            {(levels ?? [])
              .filter((l) => l.id !== promoteTarget?.id)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} Level ({l._count.students} current students)
                </option>
              ))}
          </select>
          <p className="text-[11.5px] text-[var(--color-ink-subtle)]">
            Student accounts and their historical attendance records are preserved.
          </p>
        </div>
      </Modal>

      {/* Modal: Delete Level */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove Academic Level?"
        description={
          deleteTarget && deleteTarget._count.students > 0
            ? `${deleteTarget._count.students} student(s) are currently in this level. Reassign them first.`
            : "Are you sure you want to remove this academic level?"
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={!!deleteTarget && deleteTarget._count.students > 0}>
              Remove Level
            </Button>
          </>
        }
      >
        <></>
      </Modal>
    </AppShell>
  );
}
