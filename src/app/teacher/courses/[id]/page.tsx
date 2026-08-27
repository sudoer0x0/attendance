"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { AppShell, PageHeader } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/Button";
import { Table, TableHead, TableBody, TableRow, Th, Td, EmptyState } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/apiFetch";

interface SessionSummary {
  id: string;
  date: string;
  status: "ACTIVE" | "ENDED";
  _count: { attendances: number };
}

interface Course {
  id: string;
  code: string;
  name: string;
  sessions: SessionSummary[];
}

interface AttendanceRow {
  id: string;
  matricNo: string;
  surname: string;
  firstName: string;
  timestamp: string;
  method: "QR" | "MANUAL";
}

const navItems = [{ label: "My courses", href: "/teacher/courses", active: true }];

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = use(params);
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [viewSession, setViewSession] = useState<SessionSummary | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[] | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/courses/${courseId}`);
    if (res.ok) setCourse(await res.json());
  }, [courseId]);

  useEffect(() => {
    // See HANDOFF.md "Known gaps — Frontend data fetching" re: this lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function openSession(s: SessionSummary) {
    setViewSession(s);
    setAttendance(null);
    const res = await apiFetch(`/api/sessions/${s.id}/attendance`);
    if (res.ok) {
      const data = await res.json();
      setAttendance(data.attendances);
    }
  }

  const sortedSessions = course
    ? [...course.sessions].sort((a, b) =>
        sortNewestFirst ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
      )
    : [];

  return (
    <AppShell navItems={navItems} orgLabel="Attend" userLabel="Staff Member">
      <PageHeader
        title={course ? `${course.code} — ${course.name}` : "Loading..."}
        description={course ? `${course.sessions.length} session${course.sessions.length === 1 ? "" : "s"} recorded` : undefined}
        actions={
          <Button variant="secondary" onClick={() => router.push("/teacher/courses")}>
            Back to courses
          </Button>
        }
      />

      <div className="px-4 pb-8 pt-4 md:px-6">
        {course === null ? (
          <p className="py-10 text-center text-[13px] text-[var(--color-ink-subtle)]">Loading...</p>
        ) : course.sessions.length === 0 ? (
          <EmptyState title="No sessions yet" description="Start a session from the course card to begin taking attendance." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <Th>
                  <button
                    onClick={() => setSortNewestFirst((v) => !v)}
                    className="flex items-center gap-1 hover:text-[var(--color-ink)]"
                  >
                    Date {sortNewestFirst ? "↓" : "↑"}
                  </button>
                </Th>
                <Th>Status</Th>
                <Th>Checked in</Th>
                <Th />
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedSessions.map((s) => (
                <TableRow key={s.id} clickable onClick={() => openSession(s)}>
                  <Td className="font-medium">{format(new Date(s.date), "EEE d MMM yyyy, h:mm a")}</Td>
                  <Td>
                    {s.status === "ACTIVE" ? (
                      <Badge tone="success" dot>
                        Live
                      </Badge>
                    ) : (
                      <Badge tone="neutral">Ended</Badge>
                    )}
                  </Td>
                  <Td>{s._count.attendances}</Td>
                  <Td className="text-right">
                    <a
                      href={`/api/sessions/${s.id}/export`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[13px] font-medium text-[var(--color-accent)] hover:underline"
                    >
                      Export CSV
                    </a>
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Modal
        open={!!viewSession}
        onClose={() => setViewSession(null)}
        title={viewSession ? format(new Date(viewSession.date), "EEE d MMM yyyy, h:mm a") : ""}
        description={viewSession ? `${viewSession._count.attendances} student(s) checked in` : undefined}
        size="lg"
        footer={
          viewSession && (
            <a href={`/api/sessions/${viewSession.id}/export`}>
              <Button variant="secondary">Export CSV</Button>
            </a>
          )
        }
      >
        {attendance === null ? (
          <p className="py-6 text-center text-[13px] text-[var(--color-ink-subtle)]">Loading...</p>
        ) : attendance.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[var(--color-ink-subtle)]">No one checked in for this session.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <Th>Student</Th>
                  <Th>Matric No.</Th>
                  <Th>Time</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {attendance.map((a) => (
                  <TableRow key={a.id}>
                    <Td>
                      {a.surname}, {a.firstName}
                    </Td>
                    <Td className="font-[var(--font-mono)] text-[12.5px]">{a.matricNo}</Td>
                    <Td className="whitespace-nowrap">
                      {format(new Date(a.timestamp), "h:mm:ss a")}
                      {a.method === "MANUAL" && (
                        <Badge tone="warning" className="ml-2">
                          Manual
                        </Badge>
                      )}
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
