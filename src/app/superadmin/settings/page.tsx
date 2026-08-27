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
  const [unlockTarget, setUnlockTarget] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/system-config");
    if (res.ok) setConfig(await res.json());
  }, []);

  async function handleClearLockout() {
    if (!unlockTarget.trim()) return;
    setUnlocking(true);
    try {
      const isEmail = unlockTarget.includes("@");
      const res = await apiFetch("/api/auth/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEmail ? { email: unlockTarget.trim() } : { matricNo: unlockTarget.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        push(data.message ?? "Lockout cleared successfully.", "success");
        setUnlockTarget("");
      } else {
        push(data.error ?? "Could not clear lockout.", "danger");
      }
    } finally {
      setUnlocking(false);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
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
        push("Configuration saved. Security policy updates take effect immediately.", "success");
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
      <PageHeader
        title="Institutional System Settings"
        description="Global university parameters, security authentication thresholds, and recovery tools"
      />

      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 md:px-8">
        {config === null ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
            <p className="mt-3 text-[13px] text-[var(--color-ink-subtle)]">Loading configuration...</p>
          </div>
        ) : (
          <form onSubmit={save} className="flex flex-col gap-6">
            {/* Institution Profile */}
            <Card>
              <CardHeader className="border-b border-[var(--color-border)] px-5 py-4">
                <CardTitle className="text-[15px] font-bold text-[var(--color-ink)]">
                  Institution &amp; University Profile
                </CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-4 p-5">
                <Input
                  label="Institution Name *"
                  value={config.schoolName}
                  onChange={(e) => setConfig({ ...config, schoolName: e.target.value })}
                  hint="Displayed across portal headers, login pages, and PDF/CSV reports."
                  required
                />
                <Input
                  label="Institution Logo URL (Optional)"
                  placeholder="https://..."
                  value={config.schoolLogoUrl ?? ""}
                  onChange={(e) => setConfig({ ...config, schoolLogoUrl: e.target.value })}
                  hint="Direct URL to institutional crest or seal image."
                />
              </CardBody>
            </Card>

            {/* Login & Rate Limiting Security Policy */}
            <Card>
              <CardHeader className="border-b border-[var(--color-border)] px-5 py-4">
                <CardTitle className="text-[15px] font-bold text-[var(--color-ink)]">
                  Security &amp; Rate-Limiting Policy
                </CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-4 p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Max Failed Attempts *"
                    type="number"
                    min={1}
                    max={50}
                    value={config.loginMaxAttempts}
                    onChange={(e) => setConfig({ ...config, loginMaxAttempts: Number(e.target.value) })}
                    hint="Threshold before account lockout is triggered."
                    required
                  />
                  <Input
                    label="Lockout Duration (Minutes) *"
                    type="number"
                    min={1}
                    max={1440}
                    value={config.loginLockoutMinutes}
                    onChange={(e) => setConfig({ ...config, loginLockoutMinutes: Number(e.target.value) })}
                    hint="Delay applied to failed login rate limits."
                    required
                  />
                </div>
                <Input
                  label="Student Re-Login Cooldown (Hours) *"
                  type="number"
                  min={0}
                  max={72}
                  value={config.studentLoginCooldownHours}
                  onChange={(e) => setConfig({ ...config, studentLoginCooldownHours: Number(e.target.value) })}
                  hint="Duration student must wait after logout before switching devices."
                  required
                />
              </CardBody>
            </Card>

            {/* Instant Emergency Unlock Tool */}
            <Card className="border-[var(--color-accent)]/40 ring-1 ring-[var(--color-accent)]/20">
              <CardHeader className="border-b border-[var(--color-border)] px-5 py-4 bg-[var(--color-accent-subtle)]/40">
                <CardTitle className="text-[15px] font-bold text-[var(--color-ink)]">
                  Instant Account Unlock Tool
                </CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-3.5 p-5">
                <p className="text-[12.5px] text-[var(--color-ink-subtle)] leading-relaxed">
                  Clear the 15-minute login rate-limit lockout delay for any staff member, department administrator, or student account immediately.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Input
                      label="Staff/Admin Email or Student Matric Number"
                      placeholder="e.g. j.doe@university.edu or U23CYS1074"
                      value={unlockTarget}
                      onChange={(e) => setUnlockTarget(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleClearLockout}
                    loading={unlocking}
                    disabled={!unlockTarget.trim()}
                    className="sm:mb-0.5"
                  >
                    Clear Lockout
                  </Button>
                </div>
              </CardBody>
            </Card>

            {/* Anti-Proxy QR Protocol */}
            <Card>
              <CardHeader className="border-b border-[var(--color-border)] px-5 py-4">
                <CardTitle className="text-[15px] font-bold text-[var(--color-ink)]">
                  Anti-Proxy Rotating QR Protocol
                </CardTitle>
              </CardHeader>
              <CardBody className="p-5">
                <Input
                  label="Token Rotation Frequency (Seconds)"
                  type="number"
                  value={config.qrRotationSeconds}
                  disabled
                  hint="Active anti-proxy interval: cryptographic QR codes rotate every 5 seconds with single-use verification."
                />
              </CardBody>
            </Card>

            {/* Save Action */}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="submit" loading={saving} className="shadow-sm">
                Save System Settings
              </Button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
