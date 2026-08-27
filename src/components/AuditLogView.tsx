"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Table, TableHead, TableBody, TableRow, Th, Td, EmptyState } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface AuditLogEntry {
  id: string;
  action: string;
  actorRole: string;
  actorLabel: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const roleTone: Record<string, "accent" | "warning" | "neutral" | "success"> = {
  SUPER_ADMIN: "accent",
  DEPARTMENT_ADMIN: "warning",
  TEACHER: "success",
  STUDENT: "neutral",
  SYSTEM: "neutral",
};

/** Turns "teacher.credentials_reset" into "Teacher credentials reset" —
 *  good enough for a readable log without a hand-maintained label map for
 *  every action string the app writes. */
function humanizeAction(action: string): string {
  const [, verb] = action.split(".");
  return (verb ?? action).replace(/_/g, " ");
}

export function AuditLogView() {
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (after?: string) => {
    const params = new URLSearchParams({ limit: "50" });
    if (after) params.set("cursor", after);
    const res = await fetch(`/api/audit-log?${params}`);
    if (!res.ok) return null;
    return res.json();
  }, []);

  useEffect(() => {
    load().then((data) => {
      if (data) {
        setEntries(data.logs);
        setCursor(data.nextCursor);
      }
    });
  }, [load]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const data = await load(cursor);
      if (data) {
        setEntries((prev) => [...(prev ?? []), ...data.logs]);
        setCursor(data.nextCursor);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  if (entries === null) {
    return <p className="py-10 text-center text-[13px] text-[var(--color-ink-subtle)]">Loading...</p>;
  }

  if (entries.length === 0) {
    return (
      <div className="px-4 md:px-6">
        <EmptyState title="No activity yet" description="Actions taken across the system will appear here, oldest hidden, most recent first." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 pb-8 md:px-6">
      <Table>
        <TableHead>
          <TableRow>
            <Th>When</Th>
            <Th>Actor</Th>
            <Th>Action</Th>
            <Th>Target</Th>
          </TableRow>
        </TableHead>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.id}>
              <Td className="whitespace-nowrap text-[var(--color-ink-muted)]">
                {format(new Date(e.createdAt), "d MMM, h:mm:ss a")}
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  <Badge tone={roleTone[e.actorRole] ?? "neutral"}>
                    {e.actorRole === "TEACHER" ? "STAFF" : e.actorRole.replace("_", " ")}
                  </Badge>
                  <span className="text-[var(--color-ink-muted)]">{e.actorLabel}</span>
                </div>
              </Td>
              <Td className="font-medium">{humanizeAction(e.action)}</Td>
              <Td className="font-[var(--font-mono)] text-[12px] text-[var(--color-ink-subtle)]">
                {e.targetType ? `${e.targetType}${e.targetId ? ` · ${e.targetId.slice(0, 10)}…` : ""}` : "—"}
              </Td>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {cursor && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
