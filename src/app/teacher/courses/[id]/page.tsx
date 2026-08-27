"use client";

import { useEffect, useState, useCallback, use, useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { usePortalRouter } from "@/lib/portalRouter";
import { AppShell, PageHeader } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, TableHead, TableBody, TableRow, Th, Td, EmptyState } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/apiFetch";

interface SessionSummary {
  id: string;
  date: string;
  startedAt: string;
  endedAt: string | null;
  status: "ACTIVE" | "ENDED";
  _count: { attendances: number };
}

interface StudentStat {
  id: string;
  matricNo: string;
  name: string;
  level: string;
  attendedCount: number;
  totalSessions: number;
  percentage: number;
}

interface CourseDetail {
  id: string;
  code: string;
  name: string;
  sessions: SessionSummary[];
  studentStats: StudentStat[];
  totalStudentsEncountered: number;
}

interface AttendanceRow {
  id: string;
  matricNo: string;
  surname: string;
  firstName: string;
  timestamp: string;
  method: "QR" | "MANUAL";
  manualReason?: string | null;
}

const navItems = [{ label: "My courses", href: "/teacher/courses", active: true }];

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = use(params);
  const router = usePortalRouter();
  const { push } = useToast();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"sessions" | "students">("sessions");
  const [search, setSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  const [startingSession, setStartingSession] = useState(false);

  // Session Roster Modal State
  const [viewSession, setViewSession] = useState<SessionSummary | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[] | null>(null);
  const [rosterSearch, setRosterSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<"ALL" | "QR" | "MANUAL">("ALL");

  // Manual Attendance Form State inside Roster Modal
  const [manualOpen, setManualOpen] = useState(false);
  const [manualMatric, setManualMatric] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/courses/${courseId}`);
    if (res.ok) {
      setCourse(await res.json());
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function openSessionRoster(s: SessionSummary) {
    setViewSession(s);
    setAttendance(null);
    setRosterSearch("");
    setMethodFilter("ALL");
    setManualOpen(false);
    const res = await apiFetch(`/api/sessions/${s.id}/attendance`);
    if (res.ok) {
      const data = await res.json();
      setAttendance(data.attendances);
    }
  }

  async function handleStartSession() {
    setStartingSession(true);
    try {
      const res = await apiFetch(`/api/courses/${courseId}/sessions`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        router.push(`/teacher/sessions/${data.id}`);
      } else {
        push(data.error ?? "Could not start session.", "danger");
      }
    } finally {
      setStartingSession(false);
    }
  }

  async function submitManualAttendance(e: React.FormEvent) {
    e.preventDefault();
    if (!viewSession || !manualMatric.trim() || !manualReason.trim()) return;
    setManualLoading(true);
    try {
      const res = await apiFetch(`/api/sessions/${viewSession.id}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricNo: manualMatric.trim().toUpperCase(),
          manualReason: manualReason.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        push(`Marked ${data.attendance.surname}, ${data.attendance.firstName} present.`, "success");
        setManualMatric("");
        setManualReason("");
        setManualOpen(false);
        // Refresh session roster & course stats
        const refreshRes = await apiFetch(`/api/sessions/${viewSession.id}/attendance`);
        if (refreshRes.ok) {
          const freshData = await refreshRes.json();
          setAttendance(freshData.attendances);
        }
        load();
      } else {
        push(data.error ?? "Could not mark manual attendance.", "danger");
      }
    } finally {
      setManualLoading(false);
    }
  }

  const filteredSessions = useMemo(() => {
    if (!course) return [];
    if (!search.trim()) return course.sessions;
    const q = search.toLowerCase();
    return course.sessions.filter((s) => {
      const formattedDate = format(new Date(s.date), "EEE d MMM yyyy, h:mm a").toLowerCase();
      return formattedDate.includes(q) || s.status.toLowerCase().includes(q);
    });
  }, [course, search]);

  const filteredStudents = useMemo(() => {
    if (!course) return [];
    if (!studentSearch.trim()) return course.studentStats;
    const q = studentSearch.toLowerCase();
    return course.studentStats.filter(
      (st) =>
        st.matricNo.toLowerCase().includes(q) ||
        st.name.toLowerCase().includes(q) ||
        st.level.toLowerCase().includes(q)
    );
  }, [course, studentSearch]);

  const filteredRoster = useMemo(() => {
    if (!attendance) return [];
    return attendance.filter((a) => {
      const matchesSearch =
        !rosterSearch.trim() ||
        a.matricNo.toLowerCase().includes(rosterSearch.toLowerCase()) ||
        a.surname.toLowerCase().includes(rosterSearch.toLowerCase()) ||
        a.firstName.toLowerCase().includes(rosterSearch.toLowerCase());

      const matchesMethod =
        methodFilter === "ALL" ||
        (methodFilter === "QR" && a.method === "QR") ||
        (methodFilter === "MANUAL" && a.method === "MANUAL");

      return matchesSearch && matchesMethod;
    });
  }, [attendance, rosterSearch, methodFilter]);

  const totalSessionsCount = course?.sessions.length ?? 0;
  const totalCheckinsCount = course?.sessions.reduce((sum, s) => sum + s._count.attendances, 0) ?? 0;
  const avgAttendance = totalSessionsCount > 0 ? Math.round(totalCheckinsCount / totalSessionsCount) : 0;
  const activeSession = course?.sessions.find((s) => s.status === "ACTIVE");

  return (
    <AppShell navItems={navItems} orgLabel="Attend" userLabel="Faculty Staff">
      <PageHeader
        title={course ? `${course.code} — ${course.name}` : "Loading course..."}
        description={course ? `Course code: ${course.code} · ${totalSessionsCount} recorded lecture sessions` : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => router.push("/teacher/courses")}>
              &larr; Back to Courses
            </Button>
            <a href={`/api/courses/${courseId}/export`}>
              <Button variant="secondary" title="Download entire course attendance CSV">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export Course CSV
              </Button>
            </a>
            {activeSession ? (
              <Button
                onClick={() => router.push(`/teacher/sessions/${activeSession.id}`)}
                className="bg-[var(--color-success-ink)] text-white hover:bg-[var(--color-success-ink)]/90"
              >
                Resume Active Live Session &rarr;
              </Button>
            ) : (
              <Button onClick={handleStartSession} loading={startingSession}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Start New Session
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-6 px-4 py-6 md:px-8">
        {/* Performance Metric Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-sm">
            <span className="text-[12px] font-medium text-[var(--color-ink-subtle)]">Conducted Sessions</span>
            <span className="mt-1 font-[var(--font-display)] text-[22px] font-bold text-[var(--color-ink)]">
              {course ? totalSessionsCount : "—"}
            </span>
          </div>

          <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-sm">
            <span className="text-[12px] font-medium text-[var(--color-ink-subtle)]">Total Attendances</span>
            <span className="mt-1 font-[var(--font-display)] text-[22px] font-bold text-[var(--color-accent-ink)]">
              {course ? totalCheckinsCount : "—"}
            </span>
          </div>

          <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-sm">
            <span className="text-[12px] font-medium text-[var(--color-ink-subtle)]">Average per Class</span>
            <span className="mt-1 font-[var(--font-display)] text-[22px] font-bold text-[var(--color-ink)]">
              {course ? `${avgAttendance} students` : "—"}
            </span>
          </div>

          <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 shadow-sm">
            <span className="text-[12px] font-medium text-[var(--color-ink-subtle)]">Unique Students</span>
            <span className="mt-1 font-[var(--font-display)] text-[22px] font-bold text-[var(--color-ink)]">
              {course ? `${course.totalStudentsEncountered} enrolled` : "—"}
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[var(--color-border)]">
          <button
            type="button"
            onClick={() => setActiveTab("sessions")}
            className={`border-b-2 px-5 py-2.5 text-[13.5px] font-medium transition-colors ${
              activeTab === "sessions"
                ? "border-[var(--color-accent)] font-semibold text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            Lecture Sessions ({totalSessionsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("students")}
            className={`border-b-2 px-5 py-2.5 text-[13.5px] font-medium transition-colors ${
              activeTab === "students"
                ? "border-[var(--color-accent)] font-semibold text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            Student Attendance Roster ({course?.studentStats.length ?? 0})
          </button>
        </div>

        {/* TAB 1: Sessions Log */}
        {activeTab === "sessions" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full max-w-xs">
                <input
                  type="text"
                  placeholder="Filter sessions by date..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8.5 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white pl-8 pr-3 text-xs text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
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
            </div>

            {course === null ? (
              <div className="py-16 text-center text-[13px] text-[var(--color-ink-subtle)]">Loading sessions...</div>
            ) : course.sessions.length === 0 ? (
              <EmptyState
                title="No attendance sessions recorded yet"
                description="Click 'Start New Session' above to launch the live rotating QR code for your class."
                action={
                  <Button onClick={handleStartSession} loading={startingSession}>
                    Launch First Session
                  </Button>
                }
              />
            ) : (
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-sm">
                <Table>
                  <TableHead>
                    <TableRow>
                      <Th>Session Date &amp; Time</Th>
                      <Th>Status</Th>
                      <Th>Checked-In Students</Th>
                      <Th className="text-right">Actions</Th>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredSessions.map((s) => (
                      <TableRow key={s.id}>
                        <Td className="font-medium">
                          <div>
                            <p className="text-[13.5px] font-semibold text-[var(--color-ink)]">
                              {format(new Date(s.date), "EEEE, d MMM yyyy")}
                            </p>
                            <p className="text-[12px] text-[var(--color-ink-subtle)]">
                              Started at {format(new Date(s.startedAt), "h:mm a")} ({formatDistanceToNow(new Date(s.startedAt), { addSuffix: true })})
                            </p>
                          </div>
                        </Td>
                        <Td>
                          {s.status === "ACTIVE" ? (
                            <Badge tone="success" dot>
                              Live Now
                            </Badge>
                          ) : (
                            <Badge tone="neutral">
                              Completed
                            </Badge>
                          )}
                        </Td>
                        <Td>
                          <span className="font-semibold text-[var(--color-ink)]">{s._count.attendances}</span>{" "}
                          <span className="text-[12px] text-[var(--color-ink-subtle)]">verified present</span>
                        </Td>
                        <Td className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {s.status === "ACTIVE" && (
                              <Button
                                size="sm"
                                onClick={() => router.push(`/teacher/sessions/${s.id}`)}
                                className="bg-[var(--color-success-ink)] text-white hover:bg-[var(--color-success-ink)]/90"
                              >
                                Resume Live QR
                              </Button>
                            )}
                            <Button size="sm" variant="secondary" onClick={() => openSessionRoster(s)}>
                              Inspect Roster
                            </Button>
                            <a href={`/api/sessions/${s.id}/export`} download>
                              <Button size="sm" variant="ghost" title="Export session CSV">
                                CSV
                              </Button>
                            </a>
                          </div>
                        </Td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Student Attendance Breakdown */}
        {activeTab === "students" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full max-w-xs">
                <input
                  type="text"
                  placeholder="Search student or matric no..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="h-8.5 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white pl-8 pr-3 text-xs text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
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

              <p className="text-[12px] text-[var(--color-ink-subtle)]">
                Students with <span className="font-semibold text-[var(--color-success-ink)]">&ge; 70%</span> attendance meet exam eligibility requirements.
              </p>
            </div>

            {course === null ? (
              <div className="py-16 text-center text-[13px] text-[var(--color-ink-subtle)]">Loading students...</div>
            ) : course.studentStats.length === 0 ? (
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-8 text-center">
                <p className="text-[14px] font-semibold text-[var(--color-ink)]">No student records yet</p>
                <p className="mt-1 text-[12.5px] text-[var(--color-ink-subtle)]">
                  Students will appear here automatically once they scan attendance for this course.
                </p>
              </div>
            ) : (
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-sm">
                <Table>
                  <TableHead>
                    <TableRow>
                      <Th>Matric Number</Th>
                      <Th>Student Name</Th>
                      <Th>Level</Th>
                      <Th>Attended Sessions</Th>
                      <Th>Attendance Rate</Th>
                      <Th>Eligibility</Th>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredStudents.map((st) => {
                      const isEligible = st.percentage >= 70;
                      const isWarning = st.percentage >= 50 && st.percentage < 70;

                      return (
                        <TableRow key={st.id}>
                          <Td className="font-[var(--font-mono)] font-medium text-[var(--color-ink)]">
                            {st.matricNo}
                          </Td>
                          <Td className="font-medium text-[var(--color-ink)]">{st.name}</Td>
                          <Td className="text-[12.5px] text-[var(--color-ink-subtle)]">{st.level}</Td>
                          <Td>
                            <span className="font-semibold text-[var(--color-ink)]">{st.attendedCount}</span> of {st.totalSessions}
                          </Td>
                          <Td>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-20 rounded-full bg-[var(--color-border)] overflow-hidden">
                                <div
                                  className={`h-full ${
                                    isEligible
                                      ? "bg-[var(--color-success)]"
                                      : isWarning
                                      ? "bg-[var(--color-warning)]"
                                      : "bg-[var(--color-danger)]"
                                  }`}
                                  style={{ width: `${st.percentage}%` }}
                                />
                              </div>
                              <span className="font-[var(--font-mono)] text-[12px] font-bold">
                                {st.percentage}%
                              </span>
                            </div>
                          </Td>
                          <Td>
                            <Badge tone={isEligible ? "success" : isWarning ? "warning" : "danger"}>
                              {isEligible ? "Eligible" : isWarning ? "Warning" : "At Risk"}
                            </Badge>
                          </Td>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Inspect Session Roster */}
      <Modal
        open={!!viewSession}
        onClose={() => setViewSession(null)}
        title={viewSession ? format(new Date(viewSession.date), "EEEE, d MMMM yyyy") : ""}
        description={viewSession ? `Started at ${format(new Date(viewSession.startedAt), "h:mm a")} · ${attendance?.length ?? 0} students recorded present` : undefined}
        size="lg"
        footer={
          <div className="flex w-full items-center justify-between">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setManualOpen((v) => !v)}
              className="text-[var(--color-accent-ink)]"
            >
              {manualOpen ? "Close Manual Check-in" : "+ Mark Student Present Manually"}
            </Button>
            <div className="flex gap-2">
              {viewSession && (
                <a href={`/api/sessions/${viewSession.id}/export`} download>
                  <Button variant="secondary" size="sm">
                    Export Session CSV
                  </Button>
                </a>
              )}
              <Button size="sm" onClick={() => setViewSession(null)}>
                Done
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {/* Manual Attendance Override Inline Panel */}
          {manualOpen && (
            <form onSubmit={submitManualAttendance} className="rounded-[var(--radius-md)] border border-[var(--color-accent)]/30 bg-[var(--color-accent-subtle)] p-3.5">
              <p className="text-[13px] font-bold text-[var(--color-ink)]">Manual Attendance Check-in</p>
              <p className="text-[11.5px] text-[var(--color-ink-subtle)]">
                Manually record a student present if their device was unavailable during class.
              </p>
              <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Input
                  label="Student Matric Number *"
                  placeholder="e.g. U23CYS1074"
                  value={manualMatric}
                  onChange={(e) => setManualMatric(e.target.value.toUpperCase())}
                  required
                />
                <Input
                  label="Reason for Manual Check-in *"
                  placeholder="e.g. Phone battery died in lecture"
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  required
                />
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" type="submit" loading={manualLoading}>
                  Confirm Manual Check-in
                </Button>
              </div>
            </form>
          )}

          {/* Roster Search & Filter Controls */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <input
              type="text"
              placeholder="Search attendee name or matric no..."
              value={rosterSearch}
              onChange={(e) => setRosterSearch(e.target.value)}
              className="h-8.5 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-xs focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 sm:w-60"
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMethodFilter("ALL")}
                className={`rounded px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                  methodFilter === "ALL"
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-surface-subtle)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                }`}
              >
                All ({attendance?.length ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setMethodFilter("QR")}
                className={`rounded px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                  methodFilter === "QR"
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-surface-subtle)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                }`}
              >
                QR Scans ({attendance?.filter((a) => a.method === "QR").length ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setMethodFilter("MANUAL")}
                className={`rounded px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                  methodFilter === "MANUAL"
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-surface-subtle)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                }`}
              >
                Manual ({attendance?.filter((a) => a.method === "MANUAL").length ?? 0})
              </button>
            </div>
          </div>

          {/* Roster Table */}
          {attendance === null ? (
            <p className="py-8 text-center text-[13px] text-[var(--color-ink-subtle)]">Loading roster...</p>
          ) : attendance.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[13.5px] font-semibold text-[var(--color-ink)]">No students recorded</p>
              <p className="mt-0.5 text-[12px] text-[var(--color-ink-subtle)]">
                No students checked into this lecture session.
              </p>
            </div>
          ) : filteredRoster.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-[var(--color-ink-subtle)]">
              No matching records for &quot;{rosterSearch}&quot;.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
              <Table>
                <TableHead>
                  <TableRow>
                    <Th>Student</Th>
                    <Th>Matric No.</Th>
                    <Th>Time</Th>
                    <Th>Method</Th>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRoster.map((a) => (
                    <TableRow key={a.id}>
                      <Td className="font-medium text-[var(--color-ink)]">
                        {a.surname}, {a.firstName}
                      </Td>
                      <Td className="font-[var(--font-mono)] text-[12.5px] text-[var(--color-ink)]">{a.matricNo}</Td>
                      <Td className="whitespace-nowrap text-[12px] text-[var(--color-ink-subtle)]">
                        {format(new Date(a.timestamp), "h:mm:ss a")}
                      </Td>
                      <Td>
                        {a.method === "QR" ? (
                          <Badge tone="success" dot>
                            QR Scan
                          </Badge>
                        ) : (
                          <div className="flex flex-col">
                            <Badge tone="warning">Manual Override</Badge>
                            {a.manualReason && (
                              <span className="mt-0.5 text-[10.5px] text-[var(--color-ink-subtle)] italic">
                                &quot;{a.manualReason}&quot;
                              </span>
                            )}
                          </div>
                        )}
                      </Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Modal>
    </AppShell>
  );
}
