"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell, PageHeader } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/apiFetch";

interface SystemConfig {
  schoolName: string;
  schoolLogoUrl: string | null;
  qrRotationSeconds: number;
  studentLoginCooldownHours: number;
  loginMaxAttempts: number;
  loginLockoutMinutes: number;
}

const navItems = [
  { label: "Departments", href: "/superadmin/departments" },
  { label: "Audit log", href: "/superadmin/audit" },
  { label: "Settings", href: "/superadmin/settings", active: true },
];

export default function SettingsPage() {
  const { push } = useToast();
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/system-config");
    if (res.ok) setConfig(await res.json());
  }, []);

  useEffect(() => {
    // See HANDOFF.md "Known gaps — Frontend data fetching" re: this lint rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/system-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName: config.schoolName,
          schoolLogoUrl: config.schoolLogoUrl ?? "",
          studentLoginCooldownHours: config.studentLoginCooldownHours,
          loginMaxAttempts: config.loginMaxAttempts,
          loginLockoutMinutes: config.loginLockoutMinutes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        push("Settings saved. Login-security changes take effect within 30 seconds.", "success");
        setConfig(data);
      } else {
        push(data.error ?? "Could not save settings.", "danger");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell navItems={navItems} orgLabel="Attend" userLabel="Super Admin">
      <PageHeader title="Settings" description="System-wide configuration." />

      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-5 md:px-6">
        {config === null ? (
          <p className="py-10 text-center text-[13px] text-[var(--color-ink-subtle)]">Loading...</p>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>School</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-3">
                <Input
                  label="School name"
                  value={config.schoolName}
                  onChange={(e) => setConfig({ ...config, schoolName: e.target.value })}
                />
                <Input
                  label="Logo URL"
                  placeholder="https://..."
                  value={config.schoolLogoUrl ?? ""}
                  onChange={(e) => setConfig({ ...config, schoolLogoUrl: e.target.value })}
                  hint="Optional. Not yet displayed anywhere in the UI — stored for when branding is wired up."
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Login security</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-3">
                <Input
                  label="Student re-login cooldown (hours)"
                  type="number"
                  min={0}
                  max={72}
                  value={config.studentLoginCooldownHours}
                  onChange={(e) => setConfig({ ...config, studentLoginCooldownHours: Number(e.target.value) })}
                  hint="How long a student must wait after logging out before signing back in — see design doc §4."
                />
                <Input
                  label="Max failed login attempts"
                  type="number"
                  min={1}
                  max={50}
                  value={config.loginMaxAttempts}
                  onChange={(e) => setConfig({ ...config, loginMaxAttempts: Number(e.target.value) })}
                />
                <Input
                  label="Lockout duration (minutes)"
                  type="number"
                  min={1}
                  max={1440}
                  value={config.loginLockoutMinutes}
                  onChange={(e) => setConfig({ ...config, loginLockoutMinutes: Number(e.target.value) })}
                  hint="Applies to both staff and student login attempts."
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>QR rotation</CardTitle>
              </CardHeader>
              <CardBody>
                <Input
                  label="Rotation interval (seconds)"
                  type="number"
                  value={config.qrRotationSeconds}
                  disabled
                  hint={`Currently set via the QR_ROTATION_SECONDS environment variable, not this page — changing the number here won't do anything yet. Making this genuinely live would also need the staff display's countdown timer to read it dynamically rather than a hardcoded 5s, which isn't built yet. See HANDOFF.md.`}
                />
              </CardBody>
            </Card>

            <div className="flex justify-end">
              <Button onClick={save} loading={saving}>
                Save changes
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
