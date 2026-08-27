"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toPortalPath } from "@/lib/portalRouter";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

type Stage = "password" | "totp";

function StaffSetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { push } = useToast();

  const [stage, setStage] = useState<Stage>("password");
  const [setupToken, setSetupToken] = useState(searchParams.get("token") ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please re-enter them.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/staff/complete-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not set your password.");
        return;
      }
      setSetupToken(data.setupToken);
      setQrDataUrl(data.qrDataUrl);
      setOtpauthUri(data.otpauthUri);
      setStage("totp");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitTotp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/staff/verify-totp-enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupToken, totpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "That code didn't match.");
        return;
      }
      push("Account set up.", "success");
      const fallbackUrl = toPortalPath(data.role === "DEPARTMENT_ADMIN" ? "/admin/students" : "/teacher/courses");
      router.push(data.portalUrl ?? fallbackUrl);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--color-surface-subtle)] px-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <p className="font-[var(--font-display)] text-[20px] font-bold text-[var(--color-ink)]">
            Set up your account
          </p>
          <p className="mt-1 text-[13.5px] text-[var(--color-ink-subtle)]">
            {stage === "password"
              ? "Create a password to replace your temporary one"
              : "Scan this into your authenticator app"}
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-sm)]">
          {stage === "password" ? (
            <form onSubmit={submitPassword} className="flex flex-col gap-4">
              <Input
                label="New password"
                type="password"
                required
                minLength={10}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                hint="At least 10 characters."
              />
              <Input
                label="Confirm new password"
                type="password"
                required
                minLength={10}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {error && <p role="alert" className="text-[13px] text-[var(--color-danger)]">{error}</p>}
              <Button type="submit" loading={loading}>
                Continue
              </Button>
            </form>
          ) : (
            <form onSubmit={submitTotp} className="flex flex-col gap-4">
              {qrDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- data URL, not an optimizable remote image
                <img
                  src={qrDataUrl}
                  alt="Scan with your authenticator app"
                  className="mx-auto rounded-[var(--radius-md)] border border-[var(--color-border)]"
                  width={220}
                  height={220}
                />
              )}
              {otpauthUri && (
                <details className="text-[12px] text-[var(--color-ink-subtle)]">
                  <summary className="cursor-pointer select-none">Can&apos;t scan? Enter manually</summary>
                  <code className="mt-1 block break-all font-[var(--font-mono)]">{otpauthUri}</code>
                </details>
              )}
              <Input
                label="6-digit code"
                inputMode="numeric"
                maxLength={6}
                required
                autoFocus
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
              />
              {error && <p role="alert" className="text-[13px] text-[var(--color-danger)]">{error}</p>}
              <Button type="submit" loading={loading}>
                Confirm &amp; finish setup
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StaffSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[var(--color-surface-subtle)] text-[14px] text-[var(--color-ink-subtle)]">
          Loading setup...
        </div>
      }
    >
      <StaffSetupForm />
    </Suspense>
  );
}
