"use client";

import { AppShell, PageHeader } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/Button";
import { AuditLogView } from "@/components/AuditLogView";

const navItems = [
  { label: "Departments", href: "/superadmin/departments" },
  { label: "Audit log", href: "/superadmin/audit", active: true },
  { label: "Settings", href: "/superadmin/settings" },
];

export default function SuperAdminAuditPage() {
  return (
    <AppShell navItems={navItems} orgLabel="Attend" userLabel="Super Admin">
      <PageHeader
        title="Global Security Audit Center"
        description="Immutable system-wide ledger of administrative actions, credential resets, and security events"
        actions={
          <a href="/api/audit-log/export" download>
            <Button variant="secondary" size="sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Global Audit CSV
            </Button>
          </a>
        }
      />

      <div className="py-4">
        <AuditLogView />
      </div>
    </AppShell>
  );
}
