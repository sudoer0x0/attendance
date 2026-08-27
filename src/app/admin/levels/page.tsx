"use client";

import { useEffect, useState, useCallback } from "react";
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
    setLoading(true);
    try {
      const res = await apiFetch("/api/levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newLevelName }),
      });
      const data = await res.json();
      if (res.ok) {
        push("Level added.", "success");
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
        push(`Successfully moved ${data.count} students to the new level.`, "success");
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

  return (
    <AppShell navItems={navItems} orgLabel="Attend" userLabel="Department Admin">
      <PageHeader
        title="Levels"
        description="Your department manages its own set of levels — rename them or promote students as they advance each academic year."
        actions={<Button onClick={() => setCreateOpen(true)}>Add level</Button>}
      />

      <div className="px-4 py-5 md:px-6">
        {levels === null ? (
          <p className="py-10 text-center text-[13px] text-[var(--color-ink-subtle)]">Loading...</p>
        ) : levels.length === 0 ? (
          <EmptyState
            title="No levels yet"
            description='Add a level (e.g. "100", "ND1") before you can add students to it.'
            action={<Button onClick={() => setCreateOpen(true)}>Add level</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {levels.map((l) => (
              <Card key={l.id} className="flex flex-col justify-between">
                <CardBody>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-[var(--font-display)] text-[16px] font-bold text-[var(--color-ink)]">
                        {l.name} Level
                      </p>
                      <p className="mt-0.5 text-[13px] text-[var(--color-ink-subtle)]">
                        {l._count.students} student{l._count.students === 1 ? "" : "s"} enrolled
                      </p>
                    </div>
                  </div>
                </CardBody>

                <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-2.5 bg-[var(--color-surface-subtle)]/50">
                  <div className="flex gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditTarget(l);
                        setEditName(l.name);
                      }}
                    >
                      Edit
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
                        Promote all &rarr;
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
            ))}
          </div>
        )}
      </div>

      {/* Add Level Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add level"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createLevel} loading={loading} disabled={!newLevelName.trim()}>
              Add level
            </Button>
          </>
        }
      >
        <Input
          label="Level name"
          placeholder='e.g. "100", "ND1", "Year 3", "Final Year"'
          value={newLevelName}
          onChange={(e) => setNewLevelName(e.target.value)}
          hint="Free text — your department isn't limited to a fixed 100–500 scheme."
        />
      </Modal>

      {/* Edit Level Modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit level name"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button onClick={updateLevel} loading={loading} disabled={!editName.trim()}>
              Save changes
            </Button>
          </>
        }
      >
        <Input
          label="Level name"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
        />
      </Modal>

      {/* Bulk Promote Students Modal */}
      <Modal
        open={!!promoteTarget}
        onClose={() => setPromoteTarget(null)}
        title={`Promote ${promoteTarget?.name ?? ""} Level students`}
        description={`Move all ${promoteTarget?._count.students ?? 0} students enrolled in ${promoteTarget?.name ?? ""} Level to the next level.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPromoteTarget(null)}>
              Cancel
            </Button>
            <Button onClick={executePromote} loading={loading} disabled={!promoteToLevelId}>
              Promote students
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="text-[13px] font-medium text-[var(--color-ink)]">Target Level</label>
          <select
            value={promoteToLevelId}
            onChange={(e) => setPromoteToLevelId(e.target.value)}
            className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
          >
            <option value="">Select target level</option>
            {(levels ?? [])
              .filter((l) => l.id !== promoteTarget?.id)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} Level ({l._count.students} current students)
                </option>
              ))}
          </select>
        </div>
      </Modal>

      {/* Delete Level Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove this level?"
        description={
          deleteTarget && deleteTarget._count.students > 0
            ? `${deleteTarget._count.students} student(s) are still in this level — move them to another level first.`
            : "This can't be undone if no students are in it."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={!!deleteTarget && deleteTarget._count.students > 0}>
              Remove level
            </Button>
          </>
        }
      >
        <></>
      </Modal>
    </AppShell>
  );
}
