"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { EmptyState } from "@/components/ui/Table";
import { apiFetch } from "@/lib/apiFetch";

interface Record {
  id: string;
  courseCode: string;
  courseName: string;
  timestamp: string;
  method: "QR" | "MANUAL";
}

export default function HistoryPage() {
  const [records, setRecords] = useState<Record[] | null>(null);

  useEffect(() => {
    apiFetch("/api/attendance/my-history")
      .then((res) => res.json())
      .then(setRecords)
      .catch(() => setRecords([]));
  }, []);

  return (
    <div className="min-h-dvh bg-[var(--color-surface-subtle)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-white px-4 py-3.5">
        <div className="flex items-center gap-3">
          <a href="/student/dashboard" className="text-[13px] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
            &larr; Dashboard
          </a>
          <span className="font-[var(--font-display)] text-[15px] font-bold text-[var(--color-ink)]">
            Attendance history
          </span>
        </div>
        <a href="/student/dashboard" className="text-[13px] font-medium text-[var(--color-accent)]">
          Scan QR
        </a>
      </header>

      <div className="mx-auto max-w-lg px-4 py-4">
        {records === null ? (
          <p className="py-10 text-center text-[13px] text-[var(--color-ink-subtle)]">Loading...</p>
        ) : records.length === 0 ? (
          <EmptyState
            title="No attendance recorded yet"
            description="Once you scan a code in class, it'll show up here as your record."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {records.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-3"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-[13.5px] font-medium text-[var(--color-ink)] break-words">
                    {r.courseCode} — {r.courseName}
                  </p>
                  <p className="text-[12.5px] text-[var(--color-ink-subtle)]">
                    {format(new Date(r.timestamp), "EEE d MMM · h:mm a")}
                    {r.method === "MANUAL" && " · added manually"}
                  </p>
                </div>
                <span className="flex size-6 items-center justify-center rounded-full bg-[var(--color-success-subtle)]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="var(--color-success-ink)"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
