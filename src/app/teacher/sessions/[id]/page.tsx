"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { apiFetch } from "@/lib/apiFetch";

const ROTATION_SECONDS = 5; // mirrors QR_ROTATION_SECONDS; see HANDOFF.md to make this dynamic

type ViewState = "live" | "ending" | "ended";

/**
 * Design note (frontend-design skill "signature element"): this is the one
 * screen students and teachers actually watch for a sustained period, so
 * it's the one place worth a deliberate, slightly bolder visual moment —
 * everywhere else in the product stays quiet and dense. The countdown ring
 * is not decoration: it's making the rotation mechanism itself legible to
 * a room of students, which is the actual thing this product is trying to
 * build trust around.
 */
export default function LiveSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params);
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [checkedIn, setCheckedIn] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROTATION_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>("live");
  const lastTokenRef = useRef<string | null>(null);

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
            // Session was ended elsewhere (e.g. a second tab) — reflect
            // that here too rather than showing a generic error forever.
            setView("ended");
            return;
          }
          setError(data.error ?? "Could not load session");
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        setError(null);
        setCheckedIn(data.checkedInCount);
        setSecondsLeft(Math.max(0, Math.round((data.expiresAt - Date.now()) / 1000)));

        if (data.token !== lastTokenRef.current && canvasRef.current) {
          lastTokenRef.current = data.token;
          const payload = JSON.stringify({ sessionId, token: data.token });
          await QRCode.toCanvas(canvasRef.current, payload, {
            width: 320,
            margin: 1,
            color: { dark: "#16181d", light: "#ffffff" },
          });
        }
      } catch {
        if (!cancelled) setError("Connection lost — retrying...");
      }
    }

    poll();
    const interval = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sessionId, view]);

  async function endSession() {
    setView("ending");
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}`, { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not end session.");
        setView("live");
        return;
      }
      setView("ended");
    } catch {
      setError("Could not end session. Check your connection and try again.");
      setView("live");
    }
  }

  const progress = (secondsLeft / ROTATION_SECONDS) * 100;

  if (view === "ended") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-4 text-center">
        <Badge tone="neutral">Session ended</Badge>
        <p className="text-[16px] font-semibold text-[var(--color-ink)]">
          {checkedIn} student{checkedIn === 1 ? "" : "s"} checked in
        </p>
        <Button onClick={() => router.push("/teacher/courses")}>Back to courses</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-white px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex items-center gap-2">
          <Badge tone="success" dot>
            Session live
          </Badge>
          <span className="text-[13px] text-[var(--color-ink-subtle)]">
            {checkedIn} checked in
          </span>
        </div>

        <div className="relative flex items-center justify-center">
          {/* Countdown ring — a straightforward SVG stroke-dashoffset sweep,
              re-computed each second from `progress`. Deliberately simple:
              one clean, legible motion, not an orchestrated effect. */}
          <svg width="352" height="352" className="-rotate-90">
            <circle
              cx="176"
              cy="176"
              r="168"
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="3"
            />
            <circle
              cx="176"
              cy="176"
              r="168"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 168}
              strokeDashoffset={2 * Math.PI * 168 * (1 - progress / 100)}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <canvas
            ref={canvasRef}
            className="absolute rounded-[var(--radius-md)]"
            width={320}
            height={320}
          />
        </div>

        {error ? (
          <p className="text-[13px] text-[var(--color-danger)]">{error}</p>
        ) : (
          <p className="font-[var(--font-mono)] text-[12.5px] text-[var(--color-ink-subtle)]">
            Refreshes every {ROTATION_SECONDS}s · code expires the instant it&apos;s scanned
          </p>
        )}

        <Button variant="secondary" onClick={endSession} loading={view === "ending"}>
          End session
        </Button>
      </div>
    </div>
  );
}
