"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--color-surface-subtle)] px-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <Badge tone="accent">Campus Attendance System</Badge>
          <h1 className="mt-3 font-[var(--font-display)] text-[24px] font-bold text-[var(--color-ink)]">
            Attend
          </h1>
          <p className="mt-1 text-[14px] text-[var(--color-ink-subtle)]">
            Sign in to mark or verify class attendance
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href="/student/login"
            className="group flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-accent)]/40 bg-white p-5 shadow-[var(--shadow-sm)] transition-all hover:border-[var(--color-accent)] hover:shadow-md"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-subtle)] text-[var(--color-accent-ink)]">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
                  Student Portal
                </p>
                <p className="text-[12.5px] text-[var(--color-ink-subtle)]">
                  Sign in with Matric number &amp; Passkey / Biometrics
                </p>
              </div>
            </div>
            <span className="text-[var(--color-accent)] group-hover:translate-x-0.5 transition-transform">
              &rarr;
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
