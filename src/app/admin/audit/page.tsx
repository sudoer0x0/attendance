import { AppShell, PageHeader } from "@/components/ui/AppShell";
import { AuditLogView } from "@/components/AuditLogView";

const navItems = [
  { label: "Students", href: "/admin/students" },
  { label: "Staff", href: "/admin/teachers" },
  { label: "Levels", href: "/admin/levels" },
  { label: "Audit log", href: "/admin/audit", active: true },
];

export default function AdminAuditPage() {
  return (
    <AppShell navItems={navItems} orgLabel="Attend" userLabel="Department Admin">
      <PageHeader
        title="Audit log"
        description="Actions taken by you and your department's staff. Read-only — this log can't be edited or deleted, including by you."
      />
      <AuditLogView />
    </AppShell>
  );
}
