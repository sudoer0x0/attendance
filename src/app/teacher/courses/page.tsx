"use client";

import { useEffect, useState, useMemo } from "react";
import { format } from "date-fns";
import { usePortalRouter } from "@/lib/portalRouter";
import { AppShell, PageHeader } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/apiFetch";

interface Course {
  id: string;
  code: string;
  name: string;
  createdAt: string;
  activeSession: { id: string; startedAt: string } | null;
  totalAttendances: number;
  lastSessionDate: string | null;
  _count: { sessions: number };
}

const navItems = [{ label: "My courses", href: "/teacher/courses", active: true }];

export default function CoursesPage() {
  const router = usePortalRouter();
  const { push } = useToast();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ code: "", name: "" });
  const [createLoading, setCreateLoading] = useState(false);

  const [editTarget, setEditTarget] = useState<Course | null>(null);
  const [editForm, setEditForm] = useState({ code: "", name: "" });
  const [editLoading, setEditLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [startingSessionId, setStartingSessionId] = useState<string | null>(null);

  async function load() {
    const res = await apiFetch("/api/courses");
    if (res.ok) {
      setCourses(await res.json());
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.code.trim() || !createForm.name.trim()) return;
    setCreateLoading(true);
    try {
      const res = await apiFetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: createForm.code.trim().toUpperCase(),
          name: createForm.name.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        push("Course created successfully.", "success");
        setCreateOpen(false);
        setCreateForm({ code: "", name: "" });
        load();
      } else {
        push(data.error ?? "Could not create course.", "danger");
      }
    } finally {
      setCreateLoading(false);
    }
  }

  async function saveEditCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget || !editForm.code.trim() || !editForm.name.trim()) return;
    setEditLoading(true);
    try {
      const res = await apiFetch(`/api/courses/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editForm.code.trim().toUpperCase(),
          name: editForm.name.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        push("Course updated successfully.", "success");
        setEditTarget(null);
        load();
      } else {
        push(data.error ?? "Could not update course.", "danger");
      }
    } finally {
      setEditLoading(false);
    }
  }

  async function confirmArchiveCourse() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await apiFetch(`/api/courses/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        push("Course archived successfully.", "success");
        setDeleteTarget(null);
        load();
      } else {
        push(data.error ?? "Could not archive course.", "danger");
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  async function startSession(courseId: string) {
    setStartingSessionId(courseId);
    try {
      const res = await apiFetch(`/api/courses/${courseId}/sessions`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        router.push(`/teacher/sessions/${data.id}`);
      } else {
        push(data.error ?? "Could not start session.", "danger");
      }
    } finally {
      setStartingSessionId(null);
    }
  }

  const filteredCourses = useMemo(() => {
    if (!courses) return [];
    if (!search.trim()) return courses;
    const q = search.toLowerCase().trim();
    return courses.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [courses, search]);

  const stats = useMemo(() => {
    if (!courses) return { totalCourses: 0, totalSessions: 0, totalAttendances: 0, activeCount: 0 };
    return {
      totalCourses: courses.length,
      totalSessions: courses.reduce((sum, c) => sum + c._count.sessions, 0),
      totalAttendances: courses.reduce((sum, c) => sum + c.totalAttendances, 0),
      activeCount: courses.filter((c) => !!c.activeSession).length,
    };
  }, [courses]);

  const activeLiveCourse = courses?.find((c) => !!c.activeSession);

  return (
    <AppShell navItems={navItems} orgLabel="Attend" userLabel="Faculty Staff">
      <PageHeader
        title="My Courses"
        description="Launch live attendance sessions and review student attendance records"
        actions={
          <Button onClick={() => setCreateOpen(true)} className="shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            Create Course
          </Button>
        }
      />

      <div className="flex flex-col gap-6 px-4 py-6 md:px-8">
        {/* Active Session Highlight Banner */}
        {activeLiveCourse?.activeSession && (
          <div className="flex flex-col items-start justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-success)]/40 bg-[var(--color-success-subtle)] p-4 shadow-sm sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-success)] opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--color-success)]"></span>
              </span>
              <div>
                <p className="text-[13.5px] font-bold text-[var(--color-success-ink)]">
                  Live Attendance Session Active: {activeLiveCourse.code} ({activeLiveCourse.name})
                </p>
                <p className="text-[12px] text-[var(--color-ink-subtle)]">
                  Started {format(new Date(activeLiveCourse.activeSession.startedAt), "h:mm a")} · QR code is currently rotating
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => router.push(`/teacher/sessions/${activeLiveCourse.activeSession!.id}`)}
              className="bg-[var(--color-success-ink)] text-white hover:bg-[var(--color-success-ink)]/90"
            >
              Resume Live Session &rarr;
            </Button>
          </div>
        )}

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-sm">
            <span className="text-[12px] font-medium text-[var(--color-ink-subtle)]">Assigned Courses</span>
            <span className="mt-1 font-[var(--font-display)] text-[22px] font-bold text-[var(--color-ink)]">
              {courses ? stats.totalCourses : "—"}
            </span>
          </div>

          <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-sm">
            <span className="text-[12px] font-medium text-[var(--color-ink-subtle)]">Total Lectures Conducted</span>
            <span className="mt-1 font-[var(--font-display)] text-[22px] font-bold text-[var(--color-ink)]">
              {courses ? stats.totalSessions : "—"}
            </span>
          </div>

          <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-sm">
            <span className="text-[12px] font-medium text-[var(--color-ink-subtle)]">Verified Attendances</span>
            <span className="mt-1 font-[var(--font-display)] text-[22px] font-bold text-[var(--color-accent-ink)]">
              {courses ? stats.totalAttendances : "—"}
            </span>
          </div>

          <div className="col-span-2 flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-sm sm:col-span-1">
            <span className="text-[12px] font-medium text-[var(--color-ink-subtle)]">Live Session Status</span>
            <div className="mt-1 flex items-center gap-2">
              <Badge tone={stats.activeCount > 0 ? "success" : "neutral"} dot={stats.activeCount > 0}>
                {stats.activeCount > 0 ? "1 Active Session" : "All Idle"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <input
              type="text"
              placeholder="Search course code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white pl-9 pr-3 text-[13px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-subtle)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3 top-2.5 text-[var(--color-ink-subtle)]"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>

          {courses && (
            <p className="text-[12.5px] text-[var(--color-ink-subtle)]">
              Showing <span className="font-semibold text-[var(--color-ink)]">{filteredCourses.length}</span> of {courses.length} course{courses.length === 1 ? "" : "s"}
            </p>
          )}
        </div>

        {/* Courses Grid */}
        {courses === null ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
            <p className="mt-3 text-[13px] text-[var(--color-ink-subtle)]">Loading courses...</p>
          </div>
        ) : courses.length === 0 ? (
          <EmptyState
            title="No courses created yet"
            description="Create your first course code to start taking verified classroom attendance."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                Create First Course
              </Button>
            }
          />
        ) : filteredCourses.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white py-12 text-center">
            <p className="text-[14px] font-semibold text-[var(--color-ink)]">No matching courses</p>
            <p className="mt-1 text-[12.5px] text-[var(--color-ink-subtle)]">
              No course matches &quot;{search}&quot;. Try a different query or clear the search.
            </p>
            <Button variant="secondary" size="sm" onClick={() => setSearch("")} className="mt-3">
              Clear Search
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((c) => {
              const isLive = !!c.activeSession;
              return (
                <Card
                  key={c.id}
                  className={`flex flex-col justify-between transition-all duration-150 hover:shadow-md ${
                    isLive ? "border-[var(--color-success)]/60 ring-1 ring-[var(--color-success)]/40" : ""
                  }`}
                >
                  <CardBody className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded-[var(--radius-sm)] bg-[var(--color-surface-subtle)] px-2.5 py-1 font-[var(--font-mono)] text-[12.5px] font-bold text-[var(--color-accent)]">
                        {c.code}
                      </span>
                      <div className="flex items-center gap-1">
                        {isLive && (
                          <Badge tone="success" dot>
                            Live
                          </Badge>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditTarget(c);
                            setEditForm({ code: c.code, name: c.name });
                          }}
                          className="rounded p-1 text-[var(--color-ink-subtle)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-ink)]"
                          title="Edit course"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            <path d="m15 5 4 4" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(c)}
                          className="rounded p-1 text-[var(--color-ink-subtle)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                          title="Archive course"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <h3 className="mt-2.5 font-[var(--font-display)] text-[16px] font-bold leading-snug text-[var(--color-ink)]">
                      {c.name}
                    </h3>

                    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[var(--color-border)]/60 pt-3 text-[12px]">
                      <div>
                        <span className="text-[var(--color-ink-subtle)]">Sessions:</span>
                        <p className="font-semibold text-[var(--color-ink)]">
                          {c._count.sessions} {c._count.sessions === 1 ? "lecture" : "lectures"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[var(--color-ink-subtle)]">Total Check-ins:</span>
                        <p className="font-semibold text-[var(--color-accent-ink)]">
                          {c.totalAttendances} verified
                        </p>
                      </div>
                    </div>
                  </CardBody>

                  <div className="flex gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-subtle)]/50 px-4 py-3">
                    {isLive ? (
                      <Button
                        size="sm"
                        onClick={() => router.push(`/teacher/sessions/${c.activeSession!.id}`)}
                        className="flex-1 bg-[var(--color-success-ink)] text-white hover:bg-[var(--color-success-ink)]/90"
                      >
                        Resume Live QR &rarr;
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => startSession(c.id)}
                        loading={startingSessionId === c.id}
                        className="flex-1 shadow-sm"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        Start Session
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => router.push(`/teacher/courses/${c.id}`)}
                      className="px-3"
                    >
                      Roster &amp; History
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Create New Course */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create New Course"
        description="Enter the course details to begin taking classroom attendance."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createCourse} loading={createLoading}>
              Create Course
            </Button>
          </>
        }
      >
        <form onSubmit={createCourse} className="flex flex-col gap-3.5">
          <Input
            label="Course Code *"
            placeholder="e.g. CSC301 or MTH101"
            value={createForm.code}
            onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
            hint="A unique identifier for this course"
            required
            autoFocus
          />
          <Input
            label="Course Title *"
            placeholder="e.g. Data Structures and Algorithms"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            required
          />
        </form>
      </Modal>

      {/* Modal: Edit Course */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Course Details"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button onClick={saveEditCourse} loading={editLoading}>
              Save Changes
            </Button>
          </>
        }
      >
        <form onSubmit={saveEditCourse} className="flex flex-col gap-3.5">
          <Input
            label="Course Code *"
            value={editForm.code}
            onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
            required
          />
          <Input
            label="Course Title *"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            required
          />
        </form>
      </Modal>

      {/* Modal: Archive Course */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Archive Course?"
        description="Are you sure you want to archive this course? Past attendance records will remain safely preserved."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={confirmArchiveCourse} loading={deleteLoading} className="text-[var(--color-danger)]">
              Archive Course
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)] p-3 text-[13px]">
            <p className="font-semibold text-[var(--color-ink)]">{deleteTarget.code} — {deleteTarget.name}</p>
            <p className="mt-1 text-[12px] text-[var(--color-ink-subtle)]">
              Contains {deleteTarget._count.sessions} past attendance session(s).
            </p>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
