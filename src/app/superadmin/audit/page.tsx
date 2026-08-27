import { AppShell, PageHeader } from "@/components/ui/AppShell";
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
        title="Audit log"
        description="Every sensitive action across the system. Read-only — this log can't be edited or deleted, including by you."
      />
      <AuditLogView />
    </AppShell>
  );
}
