"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StudentRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/student/dashboard");
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--color-surface-subtle)]">
      <p className="text-[13px] text-[var(--color-ink-subtle)]">Loading student portal...</p>
    </div>
  );
}
