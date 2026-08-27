"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, PageHeader } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/apiFetch";

interface Course {
  id: string;
  code: string;
  name: string;
  _count: { sessions: number };
}

const navItems = [{ label: "My courses", href: "/teacher/courses", active: true }];

export default function CoursesPage() {
  const router = useRouter();
  const { push } = useToast();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "" });
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await apiFetch("/api/courses");
    if (res.ok) setCourses(await res.json());
  }

  useEffect(() => {
    // See HANDOFF.md "Known gaps — Frontend data fetching" re: this lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function createCourse() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        push("Course created.", "success");
        setCreateOpen(false);
        setForm({ code: "", name: "" });
        load();
      } else {
        push(data.error ?? "Could not create course.", "danger");
      }
    } finally {
      setLoading(false);
    }
  }

  async function startSession(courseId: string) {
    const res = await apiFetch(`/api/courses/${courseId}/sessions`, { method: "POST" });
    const data = await res.json();
    if (res.ok) router.push(`/teacher/sessions/${data.id}`);
    else push(data.error ?? "Could not start session.", "danger");
  }

  return (
    <AppShell navItems={navItems} orgLabel="Attend" userLabel="Staff Member">
      <PageHeader title="My courses" actions={<Button onClick={() => setCreateOpen(true)}>New course</Button>} />

      <div className="px-4 py-5 md:px-6">
        {courses === null ? (
          <p className="py-10 text-center text-[13px] text-[var(--color-ink-subtle)]">Loading...</p>
        ) : courses.length === 0 ? (
          <EmptyState
            title="No courses yet"
            description="Create a course to start taking attendance for it."
            action={<Button onClick={() => setCreateOpen(true)}>New course</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Card key={c.id} className="flex flex-col justify-between">
                <CardBody>
                  <p className="font-[var(--font-mono)] text-[12px] font-medium text-[var(--color-accent)]">
                    {c.code}
                  </p>
                  <p className="mt-1 font-[var(--font-display)] text-[15px] font-bold text-[var(--color-ink)]">
                    {c.name}
                  </p>
                  <p className="mt-1 text-[12.5px] text-[var(--color-ink-subtle)]">
                    {c._count.sessions} session{c._count.sessions === 1 ? "" : "s"} recorded
                  </p>
                </CardBody>
                <div className="flex gap-2 border-t border-[var(--color-border)] px-4 py-3">
                  <Button size="sm" onClick={() => startSession(c.id)}>
                    Start session
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => router.push(`/teacher/courses/${c.id}`)}>
                    View sessions
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New course"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createCourse} loading={loading}>
              Create
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="Course code" placeholder="e.g. CSC301" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Input label="Course name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
      </Modal>
    </AppShell>
  );
}
