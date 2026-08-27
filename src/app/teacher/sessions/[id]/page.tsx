"use client";

import { useEffect, useRef, useState, use, useCallback } from "react";
import { format } from "date-fns";
import QRCode from "qrcode";
import { usePortalRouter } from "@/lib/portalRouter";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/apiFetch";

const ROTATION_SECONDS = 5;

type ViewState = "live" | "ending" | "ended";

interface AttendeeItem {
  id: string;
  matricNo: string;
  name: string;
  timestamp: string;
  method: "QR" | "MANUAL";
}

export default function LiveSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params);
  const router = usePortalRouter();
  const { push } = useToast();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [checkedIn, setCheckedIn] = useState(0);
  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROTATION_SECONDS);
  const [recentAttendees, setRecentAttendees] = useState<AttendeeItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>("live");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Manual Check-in Modal State
  const [manualOpen, setManualOpen] = useState(false);
  const [manualMatric, setManualMatric] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  // End Session Confirmation Modal
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);

  const lastTokenRef = useRef<string | null>(null);

  // Poll QR token & real-time attendee feed every second
  useEffect(() => {
    if (view !== "live") return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await apiFetch(`/api/sessions/${sessionId}/qr`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (cancelled) return;
          if (res.status === 409) {
            setView("ended");
            return;
          }
          setError(data.error ?? "Could not load session.");
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        setError(null);
        setCheckedIn(data.checkedInCount);
        if (data.courseCode) setCourseCode(data.courseCode);
        if (data.courseName) setCourseName(data.courseName);
        if (data.startedAt) setStartedAt(data.startedAt);
        if (data.recentAttendances) setRecentAttendees(data.recentAttendances);

        setSecondsLeft(Math.max(0, Math.round((data.expiresAt - Date.now()) / 1000)));

        if (data.token !== lastTokenRef.current && canvasRef.current) {
          lastTokenRef.current = data.token;
          const payload = JSON.stringify({ sessionId, token: data.token });
          await QRCode.toCanvas(canvasRef.current, payload, {
            width: isFullscreen ? 380 : 320,
            margin: 1,
            color: { dark: "#0f172a", light: "#ffffff" },
          });
        }
      } catch {
        if (!cancelled) setError("Connection interrupted — attempting to reconnect...");
      }
    }

    poll();
    const interval = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sessionId, view, isFullscreen]);

  // Elapsed timer clock
  useEffect(() => {
    if (view !== "live" || !startedAt) return;
    const updateElapsed = () => {
      const diff = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
      setElapsedSeconds(diff);
    };
    updateElapsed();
    const clock = setInterval(updateElapsed, 1000);
    return () => clearInterval(clock);
  }, [startedAt, view]);

  // Fullscreen toggle handler
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  async function handleEndSession() {
    setEndConfirmOpen(false);
    setView("ending");
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}`, { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not end session.");
        setView("live");
        return;
      }
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setView("ended");
      push("Attendance session ended.", "success");
    } catch {
      setError("Could not end session. Check your connection and try again.");
      setView("live");
    }
  }

  async function submitManualCheckin(e: React.FormEvent) {
    e.preventDefault();
    if (!manualMatric.trim() || !manualReason.trim()) return;
    setManualLoading(true);
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}/attendance`, {
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
        setCheckedIn((prev) => prev + 1);
        setRecentAttendees((prev) => [
          {
            id: data.attendance.id,
            matricNo: data.attendance.matricNo,
            name: `${data.attendance.surname}, ${data.attendance.firstName}`,
            timestamp: data.attendance.timestamp,
            method: data.attendance.method,
          },
          ...prev.slice(0, 7),
        ]);
      } else {
        push(data.error ?? "Could not mark manual check-in.", "danger");
      }
    } finally {
      setManualLoading(false);
    }
  }

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    if (h > 0) return `${h}:${rm.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${rm.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const progress = (secondsLeft / ROTATION_SECONDS) * 100;

  // View: Session Ended Summary State
  if (view === "ended") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--color-surface-subtle)] px-4 py-8 text-center">
        <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-6 sm:p-8 shadow-sm">
          <Badge tone="neutral" className="mx-auto text-[13px] px-3 py-1">
            Session Completed
          </Badge>
          <h2 className="mt-3 font-[var(--font-display)] text-[22px] font-bold text-[var(--color-ink)]">
            {courseCode || "Class"} Attendance Recorded
          </h2>
          <p className="mt-1 text-[13.5px] text-[var(--color-ink-subtle)]">{courseName}</p>

          <div className="my-6 grid grid-cols-2 gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)] p-4 text-left">
            <div>
              <span className="text-[11.5px] font-medium text-[var(--color-ink-subtle)]">Total Checked In</span>
              <p className="font-[var(--font-display)] text-[20px] font-bold text-[var(--color-success-ink)]">
                {checkedIn} student{checkedIn === 1 ? "" : "s"}
              </p>
            </div>
            <div>
              <span className="text-[11.5px] font-medium text-[var(--color-ink-subtle)]">Session Duration</span>
              <p className="font-[var(--font-mono)] text-[18px] font-bold text-[var(--color-ink)]">
                {formatElapsed(elapsedSeconds)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <Button
              variant="secondary"
              onClick={() => setManualOpen(true)}
              className="w-full text-[var(--color-accent-ink)]"
            >
              + Mark Student Present Manually
            </Button>
            <a href={`/api/sessions/${sessionId}/export`} download className="w-full">
              <Button className="w-full shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Attendance CSV
              </Button>
            </a>
            <Button variant="secondary" onClick={() => router.push("/teacher/courses")} className="w-full">
              Return to Course Dashboard
            </Button>
          </div>
        </div>

        {/* Manual Check-in Modal for Ended State */}
        <Modal
          open={manualOpen}
          onClose={() => setManualOpen(false)}
          title="Manual Attendance Check-in"
          description="Mark a student present even after the live session has ended."
          footer={
            <>
              <Button variant="secondary" onClick={() => setManualOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitManualCheckin} loading={manualLoading}>
                Confirm Attendance
              </Button>
            </>
          }
        >
          <form onSubmit={submitManualCheckin} className="flex flex-col gap-3.5 text-left">
            <Input
              label="Student Matric Number *"
              placeholder="e.g. U23CYS1074"
              value={manualMatric}
              onChange={(e) => setManualMatric(e.target.value.toUpperCase())}
              required
              autoFocus
            />
            <Input
              label="Reason for Manual Check-in *"
              placeholder="e.g. Student attended lecture, manual confirmation"
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              required
            />
          </form>
        </Modal>
      </div>
    );
  }

  // View: Live Projector Room
  return (
    <div
      ref={containerRef}
      className={`flex min-h-dvh flex-col justify-between ${
        isFullscreen ? "bg-[#0b0f19] text-white p-6" : "bg-white p-4 md:p-8"
      }`}
    >
      {/* Top Header & Control Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)]/80 pb-4">
        <div className="flex items-center gap-3">
          <span className="rounded-[var(--radius-sm)] bg-[var(--color-accent-subtle)] px-2.5 py-1 font-[var(--font-mono)] text-[14px] font-bold text-[var(--color-accent-ink)]">
            {courseCode || "LIVE SESSION"}
          </span>
          <div>
            <h1 className={`font-[var(--font-display)] text-[17px] font-bold ${isFullscreen ? "text-white" : "text-[var(--color-ink)]"}`}>
              {courseName || "Class Attendance Session"}
            </h1>
            <div className="flex items-center gap-2 text-[12px] text-[var(--color-ink-subtle)]">
              <Badge tone="success" dot>
                QR Active
              </Badge>
              <span>Elapsed: <span className="font-[var(--font-mono)] font-semibold">{formatElapsed(elapsedSeconds)}</span></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setManualOpen(true)}>
            + Manual Check-in
          </Button>
          <Button variant="secondary" size="sm" onClick={toggleFullscreen} title="Toggle projector presentation mode">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
            {isFullscreen ? "Exit Fullscreen" : "Projector View"}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setEndConfirmOpen(true)} loading={view === "ending"}>
            End Lecture
          </Button>
        </div>
      </header>

      {/* Main Classroom Stage Area */}
      <main className="my-auto flex flex-col items-center justify-center py-6">
        <div className="flex flex-col items-center gap-5">
          {/* Headcount Banner */}
          <div className="flex items-center gap-2.5 rounded-full border border-[var(--color-success)]/40 bg-[var(--color-success-subtle)] px-5 py-1.5 shadow-sm">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-success)] opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--color-success)]"></span>
            </span>
            <span className="font-[var(--font-display)] text-[16px] font-bold text-[var(--color-success-ink)]">
              {checkedIn} student{checkedIn === 1 ? "" : "s"} verified present
            </span>
          </div>

          {/* QR Code Container with Countdown SVG Ring */}
          <div className="relative flex items-center justify-center">
            <svg width={isFullscreen ? 420 : 352} height={isFullscreen ? 420 : 352} className="-rotate-90">
              <circle
                cx={isFullscreen ? 210 : 176}
                cy={isFullscreen ? 210 : 176}
                r={isFullscreen ? 200 : 168}
                fill="none"
                stroke={isFullscreen ? "#1e293b" : "var(--color-border)"}
                strokeWidth="4"
              />
              <circle
                cx={isFullscreen ? 210 : 176}
                cy={isFullscreen ? 210 : 176}
                r={isFullscreen ? 200 : 168}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * (isFullscreen ? 200 : 168)}
                strokeDashoffset={2 * Math.PI * (isFullscreen ? 200 : 168) * (1 - progress / 100)}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <div className="absolute overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-2.5 shadow-lg">
              <canvas
                ref={canvasRef}
                className="rounded-[var(--radius-md)]"
                width={isFullscreen ? 380 : 320}
                height={isFullscreen ? 380 : 320}
              />
            </div>
          </div>

          {/* Status Instructions */}
          {error ? (
            <p className="text-[13px] font-semibold text-[var(--color-danger)]">{error}</p>
          ) : (
            <div className="text-center">
              <p className={`font-[var(--font-mono)] text-[13px] font-medium ${isFullscreen ? "text-slate-300" : "text-[var(--color-ink)]"}`}>
                Anti-Proxy Security: QR token rotates every {ROTATION_SECONDS} seconds
              </p>
              <p className="mt-0.5 text-[11.5px] text-[var(--color-ink-subtle)]">
                Each QR code is cryptographically single-use and redeemed immediately upon scan.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Real-time Attendee Ticker / Live Feed Footer */}
      <footer className="border-t border-[var(--color-border)]/80 pt-3">
        <div className="flex items-center justify-between pb-2">
          <span className={`text-[12px] font-semibold uppercase tracking-wider ${isFullscreen ? "text-slate-400" : "text-[var(--color-ink-subtle)]"}`}>
            Live Scanned Activity
          </span>
          <span className="text-[11.5px] text-[var(--color-ink-subtle)]">
            Showing recent verified scans
          </span>
        </div>

        {recentAttendees.length === 0 ? (
          <p className="py-2 text-center text-[12px] text-[var(--color-ink-subtle)]">
            Waiting for first student scan...
          </p>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {recentAttendees.map((att) => (
              <div
                key={att.id}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-[12px] transition-all animate-[fadeIn_200ms_ease-out] ${
                  isFullscreen
                    ? "border-slate-800 bg-slate-900/80 text-white"
                    : "border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-ink)]"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-[var(--color-success)]" />
                <span className="font-medium">{att.name}</span>
                <span className="font-[var(--font-mono)] text-[11px] text-[var(--color-ink-subtle)]">
                  ({att.matricNo})
                </span>
                <span className="text-[10.5px] text-[var(--color-ink-subtle)]">
                  {format(new Date(att.timestamp), "h:mm:ss a")}
                </span>
                {att.method === "MANUAL" && (
                  <span className="rounded bg-[var(--color-warning-subtle)] px-1 text-[9.5px] font-bold text-[var(--color-warning-ink)]">
                    Manual
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </footer>

      {/* Modal: Manual Attendance Override */}
      <Modal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title="Manual Attendance Check-in"
        description="Mark a student present if their camera or smartphone is unavailable."
        container={containerRef.current}
        footer={
          <>
            <Button variant="secondary" onClick={() => setManualOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitManualCheckin} loading={manualLoading}>
              Confirm Attendance
            </Button>
          </>
        }
      >
        <form onSubmit={submitManualCheckin} className="flex flex-col gap-3.5">
          <Input
            label="Student Matric Number *"
            placeholder="e.g. U23CYS1074"
            value={manualMatric}
            onChange={(e) => setManualMatric(e.target.value.toUpperCase())}
            required
            autoFocus
          />
          <Input
            label="Reason for Manual Check-in *"
            placeholder="e.g. Student camera failed, physically confirmed present"
            value={manualReason}
            onChange={(e) => setManualReason(e.target.value)}
            required
          />
        </form>
      </Modal>

      {/* Modal: Confirm End Session */}
      <Modal
        open={endConfirmOpen}
        onClose={() => setEndConfirmOpen(false)}
        title="End Lecture Session?"
        description="This will lock the attendance session and freeze further check-ins."
        container={containerRef.current}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEndConfirmOpen(false)}>
              Continue Session
            </Button>
            <Button variant="danger" onClick={handleEndSession}>
              End Session &amp; View Summary
            </Button>
          </>
        }
      >
        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)] p-3.5 text-[13px]">
          <p className="font-semibold text-[var(--color-ink)]">
            {checkedIn} student(s) currently marked present
          </p>
          <p className="mt-1 text-[12px] text-[var(--color-ink-subtle)]">
            Once ended, you can review the full roster and export the CSV report.
          </p>
        </div>
      </Modal>
    </div>
  );
}
