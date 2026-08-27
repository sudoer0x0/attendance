"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import jsQR from "jsqr";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/apiFetch";

type ScanState = "idle" | "scanning" | "submitting" | "success" | "error";

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<ScanState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const lastSubmittedRef = useRef<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  async function handleScan(rawPayload: string) {
    setState("submitting");
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
        setState("error");
        setMessage(data.error ?? "Couldn't record your attendance. Try scanning again.");
        return;
      }
      setState("success");
      setMessage(data.alreadyMarked ? "You're already checked in for this session." : null);
    } catch {
      setState("error");
      setMessage("That doesn't look like a valid attendance code.");
    }
  }

  const startCamera = useCallback(async () => {
    stopCamera();
    setState("scanning");
    setMessage(null);
    lastSubmittedRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setState("error");
      setMessage("Camera access is needed to scan the code. Check your browser permissions.");
    }
  }, [stopCamera]);

  useEffect(() => {
    if (state !== "scanning") {
      stopCamera();
      return;
    }

    let cancelled = false;
    let rafId: number;

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
  }, [state, stopCamera]);

  function reset() {
    lastSubmittedRef.current = null;
    setMessage(null);
    startCamera();
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-ink)]">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <Link href="/student/dashboard" className="flex items-center gap-1 text-[13px] font-medium text-white/80 hover:text-white">
          &larr; Dashboard
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/student/history" className="text-[13px] font-medium text-white/80 hover:text-white">
            History
          </Link>
        </div>
      </header>

      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden p-4">
        {state === "idle" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-white/10 text-white">
              <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="font-[var(--font-display)] text-[18px] font-semibold text-white">
              Ready to scan attendance?
            </p>
            <p className="max-w-xs text-[13px] text-white/70">
              Click the button below to turn on your camera and align the live QR code on the lecture display.
            </p>
            <Button onClick={startCamera} className="mt-2 bg-white text-[var(--color-ink)] hover:bg-white/90">
              Start camera
            </Button>
          </div>
        )}

        {state === "scanning" && (
          <>
            <video ref={videoRef} className="absolute inset-0 size-full object-cover" playsInline muted />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="relative h-[65%] w-[88%] max-w-[360px] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                <div className="absolute -left-1.5 -top-1.5 size-7 rounded-tl-lg border-l-4 border-t-4 border-[var(--color-accent)]" />
                <div className="absolute -right-1.5 -top-1.5 size-7 rounded-tr-lg border-r-4 border-t-4 border-[var(--color-accent)]" />
                <div className="absolute -bottom-1.5 -left-1.5 size-7 rounded-bl-lg border-b-4 border-l-4 border-[var(--color-accent)]" />
                <div className="absolute -bottom-1.5 -right-1.5 size-7 rounded-br-lg border-b-4 border-r-4 border-[var(--color-accent)]" />
                <div className="absolute left-2 right-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent opacity-80 animate-[pulse_2s_infinite]" />
              </div>
            </div>
            <div className="absolute bottom-10 z-10 flex flex-col items-center gap-2">
              <p className="rounded-full bg-black/60 px-4 py-1 text-[13px] font-medium text-white backdrop-blur-sm">
                Point at the lecturer&apos;s QR code
              </p>
              <Button size="sm" variant="secondary" onClick={() => { stopCamera(); setState("idle"); }}>
                Pause camera
              </Button>
            </div>
          </>
        )}

        {state === "submitting" && (
          <div className="z-10 flex flex-col items-center gap-3">
            <div className="size-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <p className="text-[13px] text-white/70">Checking you in...</p>
          </div>
        )}

        {state === "success" && (
          <div className="z-10 flex flex-col items-center gap-4 px-6 text-center">
            <div
              className="flex size-20 items-center justify-center rounded-full bg-[var(--color-success)]"
              style={{ animation: "checkPop 260ms ease-out" }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <p className="text-[18px] font-semibold text-white">You&apos;re checked in!</p>
              {message && <p className="mt-1 text-[13px] text-white/60">{message}</p>}
            </div>
            <div className="flex gap-3">
              <Link
                href="/student/dashboard"
                className="rounded-[var(--radius-md)] bg-white px-4 py-2 text-[13px] font-semibold text-[var(--color-ink)] hover:bg-white/90"
              >
                Back to Dashboard
              </Link>
              <button
                onClick={reset}
                className="rounded-[var(--radius-md)] border border-white/20 px-4 py-2 text-[13px] font-medium text-white hover:bg-white/10"
              >
                Scan another
              </button>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="z-10 flex flex-col items-center gap-4 px-6 text-center">
            <Badge tone="danger">Couldn&apos;t check you in</Badge>
            <p className="max-w-xs text-[13.5px] text-white/70">{message}</p>
            <div className="flex gap-3">
              <Link
                href="/student/dashboard"
                className="rounded-[var(--radius-md)] border border-white/20 px-4 py-2 text-[13px] font-medium text-white hover:bg-white/10"
              >
                Dashboard
              </Link>
              <button
                onClick={reset}
                className="rounded-[var(--radius-md)] bg-white px-4 py-2 text-[13px] font-medium text-[var(--color-ink)] hover:bg-white/90"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
