"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import jsQR from "jsqr";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Table, TableHead, TableBody, TableRow, Th, Td, EmptyState } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/apiFetch";

interface StudentProfile {
  id: string;
  matricNo: string;
  surname: string;
  firstName: string;
  displayName: string;
  level: { id: string; name: string };
  department: { id: string; name: string; code: string };
  departmentName?: string;
  departmentCode?: string;
}

interface AttendanceRecord {
  id: string;
  courseCode: string;
  courseName: string;
  timestamp: string;
  method: "QR" | "MANUAL";
}

type ScanState = "idle" | "scanning" | "submitting" | "success" | "error";

export default function StudentDashboardPage() {
  const router = useRouter();
  const { push } = useToast();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // Scanner modal state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastSubmittedRef = useRef<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [profileRes, historyRes] = await Promise.all([
        apiFetch("/api/auth/me"),
        apiFetch("/api/attendance/my-history"),
      ]);

      if (profileRes.ok) {
        const p = await profileRes.json();
        setProfile(p);
      } else {
        router.push("/student/login");
        return;
      }

      if (historyRes.ok) {
        const h = await historyRes.json();
        setHistory(h);
      }
    } catch {
      router.push("/student/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Start camera scanner
  const startCamera = useCallback(async () => {
    stopCamera();
    setScanState("scanning");
    setScanMessage(null);
    lastSubmittedRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setScanState("error");
      setScanMessage("Camera access is needed to scan the QR code. Please enable camera permissions in your browser.");
    }
  }, [facingMode, stopCamera]);

  function switchCamera() {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
  }

  useEffect(() => {
    if (scannerOpen && scanState === "scanning") {
      startCamera();
    }
  }, [facingMode, scannerOpen, scanState, startCamera]);

  // QR Frame processing loop
  useEffect(() => {
    if (!scannerOpen || scanState !== "scanning") {
      stopCamera();
      return;
    }

    let cancelled = false;
    let rafId: number;

    async function handleScan(rawPayload: string) {
      setScanState("submitting");
      stopCamera();
      try {
        const { sessionId, token } = JSON.parse(rawPayload);
        const res = await apiFetch("/api/attendance/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, token }),
        });
        const data = await res.json();

        if (!res.ok) {
          setScanState("error");
          setScanMessage(data.error ?? "Could not record your attendance. Please try again.");
          return;
        }

        setScanState("success");
        setScanMessage(data.alreadyMarked ? "You are already checked in for this session." : "Attendance marked successfully!");
        loadData();
      } catch {
        setScanState("error");
        setScanMessage("Invalid attendance QR code. Please scan the official class code.");
      }
    }

    function tick() {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data && code.data !== lastSubmittedRef.current) {
            lastSubmittedRef.current = code.data;
            handleScan(code.data);
            return;
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [scannerOpen, scanState, stopCamera, loadData]);

  // Handle opening scanner modal
  function openScannerModal() {
    setScannerOpen(true);
    setScanState("idle");
    setScanMessage(null);
    lastSubmittedRef.current = null;
  }

  // Handle closing scanner modal
  function closeScannerModal() {
    stopCamera();
    setScannerOpen(false);
    setScanState("idle");
    setScanMessage(null);
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      push("Signed out.", "neutral");
      router.push("/student/login");
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--color-surface-subtle)]">
        <p className="text-[13.5px] font-medium text-[var(--color-ink-subtle)]">Loading student portal...</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--color-surface-subtle)] pb-24 sm:pb-12">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-2.5 sm:px-6 sm:py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] font-[var(--font-display)] text-sm font-bold text-white shadow-sm sm:size-9">
              A
            </div>
            <div className="min-w-0">
              <p className="truncate font-[var(--font-display)] text-[14px] font-bold leading-tight text-[var(--color-ink)] sm:text-[15px]">
                Student Portal
              </p>
              <p className="truncate text-[11px] font-medium text-[var(--color-ink-subtle)] sm:text-[11.5px]">
                {profile?.departmentName ?? profile?.department?.name ?? "Department"} ({profile?.departmentCode ?? profile?.department?.code ?? ""})
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleLogout}
              loading={loggingOut}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-3.5 pt-4 sm:px-6 sm:pt-6">
        {/* Welcome & Student Identity Hero Card */}
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)]">
          <div className="bg-gradient-to-br from-[var(--color-accent)] via-[#2563eb] to-[#1e40af] p-5 text-white sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[11.5px] font-semibold tracking-wide text-white backdrop-blur-xs">
                  {profile?.level?.name ?? "Academic"} Level
                </span>
                <h1 className="font-[var(--font-display)] text-[20px] font-bold tracking-tight text-white sm:text-[25px]">
                  Welcome, {profile?.firstName} {profile?.surname}!
                </h1>
                <p className="text-[12.5px] font-medium text-white/85 sm:text-[13px]">
                  {profile?.departmentName ?? profile?.department?.name ?? ""}
                </p>
              </div>

              <div className="pt-1 sm:pt-0">
                <button
                  type="button"
                  onClick={openScannerModal}
                  className="flex w-full items-center justify-center gap-2.5 rounded-[var(--radius-md)] bg-white px-5 py-3.5 text-[14px] font-bold text-[var(--color-accent)] shadow-md transition-all hover:bg-white/95 hover:shadow-lg active:scale-[0.98] sm:w-auto sm:py-2.5"
                >
                  <svg
                    className="size-5 shrink-0 text-[var(--color-accent)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                    />
                  </svg>
                  <span>Scan Attendance QR</span>
                </button>
              </div>
            </div>
          </div>

          {/* Student Quick Information 2x2 / 4x1 Bar */}
          <div className="grid grid-cols-2 divide-x divide-y border-t border-[var(--color-border)] bg-[var(--color-surface-subtle)]/40 sm:grid-cols-4 sm:divide-y-0">
            <div className="p-3.5 sm:p-4">
              <p className="text-[11px] font-semibold text-[var(--color-ink-subtle)] uppercase tracking-wider">
                Matric Number
              </p>
              <p className="mt-0.5 font-[var(--font-mono)] text-[13.5px] font-bold text-[var(--color-ink)] sm:text-[14px]">
                {profile?.matricNo}
              </p>
            </div>
            <div className="p-3.5 sm:p-4">
              <p className="text-[11px] font-semibold text-[var(--color-ink-subtle)] uppercase tracking-wider">
                Current Level
              </p>
              <p className="mt-0.5 text-[13.5px] font-semibold text-[var(--color-ink)] sm:text-[14px]">
                {profile?.level?.name} Level
              </p>
            </div>
            <div className="p-3.5 sm:p-4">
              <p className="text-[11px] font-semibold text-[var(--color-ink-subtle)] uppercase tracking-wider">
                Classes Attended
              </p>
              <p className="mt-0.5 text-[14px] font-bold text-[var(--color-accent)] sm:text-[15px]">
                {history?.length ?? 0}
              </p>
            </div>
            <div className="p-3.5 sm:p-4">
              <p className="text-[11px] font-semibold text-[var(--color-ink-subtle)] uppercase tracking-wider">
                Portal Status
              </p>
              <div className="mt-0.5">
                <Badge tone="success" dot>
                  Active
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Attendance History Section */}
        <div className="mt-5 sm:mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between p-4">
              <div>
                <CardTitle className="text-[15px]">Attendance History</CardTitle>
                <p className="text-[12px] text-[var(--color-ink-subtle)]">
                  All lectures and sessions you have attended.
                </p>
              </div>
              <Button size="sm" onClick={openScannerModal} className="shrink-0">
                Scan code
              </Button>
            </CardHeader>

            <CardBody className="p-0">
              {history === null ? (
                <p className="py-10 text-center text-[13px] text-[var(--color-ink-subtle)]">
                  Loading attendance records...
                </p>
              ) : history.length === 0 ? (
                <div className="py-8 px-4">
                  <EmptyState
                    title="No attendance recorded yet"
                    description="When your lecturer presents an attendance QR code, click 'Scan Attendance QR' to mark yourself present."
                    action={
                      <Button onClick={openScannerModal}>
                        Open QR Scanner
                      </Button>
                    }
                  />
                </div>
              ) : (
                <>
                  {/* Mobile-Optimized Card List (visible on screens < sm) */}
                  <div className="divide-y divide-[var(--color-border)] sm:hidden">
                    {history.map((record) => (
                      <div key={record.id} className="flex flex-col gap-1.5 p-4 bg-white hover:bg-[var(--color-surface-subtle)]/50 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[14px] text-[var(--color-ink)]">
                            {record.courseCode}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-subtle)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--color-success-ink)]">
                            <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Present
                          </span>
                        </div>
                        <p className="text-[13px] font-medium text-[var(--color-ink-muted)]">
                          {record.courseName}
                        </p>
                        <div className="mt-1 flex items-center justify-between text-[11.5px] text-[var(--color-ink-subtle)]">
                          <span>{format(new Date(record.timestamp), "EEE, d MMM · h:mm a")}</span>
                          <Badge tone={record.method === "QR" ? "accent" : "neutral"}>
                            {record.method === "QR" ? "QR Scan" : "Manual"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table (visible on screens >= sm) */}
                  <div className="hidden sm:block">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <Th>Course</Th>
                          <Th>Date &amp; Time</Th>
                          <Th>Method</Th>
                          <Th>Status</Th>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {history.map((record) => (
                          <TableRow key={record.id}>
                            <Td>
                              <div className="font-semibold text-[var(--color-ink)]">
                                {record.courseCode}
                              </div>
                              <div className="text-[12px] text-[var(--color-ink-subtle)]">
                                {record.courseName}
                              </div>
                            </Td>
                            <Td className="text-[13px] text-[var(--color-ink-muted)]">
                              {format(new Date(record.timestamp), "EEE, d MMM yyyy · h:mm a")}
                            </Td>
                            <Td>
                              <Badge tone={record.method === "QR" ? "accent" : "neutral"}>
                                {record.method === "QR" ? "QR Scan" : "Manual Roster"}
                              </Badge>
                            </Td>
                            <Td>
                              <span className="inline-flex items-center gap-1.5 font-medium text-[12.5px] text-[var(--color-success-ink)]">
                                <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                Present
                              </span>
                            </Td>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </main>

      {/* Floating Bottom Bar for Mobile Screen Quick Action */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--color-border)] bg-white/90 p-3 backdrop-blur-md sm:hidden">
        <button
          type="button"
          onClick={openScannerModal}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-[14px] font-bold text-white shadow-lg active:scale-[0.98]"
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          <span>Scan Attendance QR</span>
        </button>
      </div>

      {/* QR Scanner Modal (Controlled on Demand) */}
      <Modal
        open={scannerOpen}
        onClose={closeScannerModal}
        title="Scan Attendance QR"
        description="Position your phone camera towards the live lecture code."
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <Button variant="secondary" onClick={closeScannerModal}>
              Close
            </Button>
            {scanState === "idle" ? (
              <Button onClick={startCamera}>
                Start camera
              </Button>
            ) : scanState === "scanning" ? (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={switchCamera}>
                  Switch camera
                </Button>
                <Button variant="secondary" onClick={() => { stopCamera(); setScanState("idle"); }}>
                  Pause
                </Button>
              </div>
            ) : (
              <Button onClick={startCamera}>
                Scan another code
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-col items-center justify-center gap-4">
          <canvas ref={canvasRef} className="hidden" />

          {scanState === "idle" && (
            <div className="flex w-full flex-col items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-6 text-center sm:p-8">
              <div className="flex size-14 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="mt-3 font-semibold text-[14px] text-[var(--color-ink)] sm:text-[15px]">
                Camera is ready
              </p>
              <p className="mt-1 max-w-xs text-[12.5px] text-[var(--color-ink-subtle)]">
                Click <strong>Start camera</strong> below to activate your scanner and point at the lecturer&apos;s display.
              </p>
              <Button className="mt-4" onClick={startCamera}>
                Start camera
              </Button>
            </div>
          )}

          {scanState === "scanning" && (
            <div className="relative aspect-square w-full max-w-[320px] overflow-hidden rounded-[var(--radius-lg)] bg-black shadow-lg">
              <video
                ref={videoRef}
                playsInline
                muted
                className="size-full object-cover"
              />
              {/* Viewfinder Target Frame */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative size-48 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                  {/* Corner accents */}
                  <div className="absolute -left-1 -top-1 size-4 border-l-4 border-t-4 border-[var(--color-accent)]" />
                  <div className="absolute -right-1 -top-1 size-4 border-r-4 border-t-4 border-[var(--color-accent)]" />
                  <div className="absolute -bottom-1 -left-1 size-4 border-b-4 border-l-4 border-[var(--color-accent)]" />
                  <div className="absolute -bottom-1 -right-1 size-4 border-b-4 border-r-4 border-[var(--color-accent)]" />
                </div>
              </div>
              <div className="absolute bottom-2 left-0 right-0 text-center text-[12px] font-medium text-white/90">
                Point at lecturer&apos;s QR code
              </div>
            </div>
          )}

          {scanState === "submitting" && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="size-10 animate-spin rounded-full border-3 border-[var(--color-accent)] border-t-transparent" />
              <p className="mt-4 font-medium text-[14px] text-[var(--color-ink)]">
                Verifying attendance code...
              </p>
            </div>
          )}

          {scanState === "success" && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success-ink)]">
                <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="mt-3 font-[var(--font-display)] text-[17px] font-bold text-[var(--color-ink)]">
                {scanMessage ?? "Checked in!"}
              </p>
              <p className="mt-1 text-[13px] text-[var(--color-ink-subtle)]">
                Your attendance has been recorded for this session.
              </p>
              <Button className="mt-5" onClick={closeScannerModal}>
                Done
              </Button>
            </div>
          )}

          {scanState === "error" && (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-[var(--color-danger-subtle)] text-[var(--color-danger)]">
                <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="mt-3 font-semibold text-[15px] text-[var(--color-danger)]">
                Scan Error
              </p>
              <p className="mt-1 max-w-xs text-[13px] text-[var(--color-ink-subtle)]">
                {scanMessage ?? "Could not scan the attendance code."}
              </p>
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" onClick={closeScannerModal}>
                  Close
                </Button>
                <Button onClick={startCamera}>
                  Try again
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
