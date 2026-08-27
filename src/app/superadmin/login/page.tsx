"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

type Stage = "credentials" | "totp";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const { push } = useToast();
  const [stage, setStage] = useState<Stage>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/staff-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          totpCode: stage === "totp" ? totpCode : undefined,
          expectedRole: "SUPER_ADMIN",
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      if (data.requiresTotp) {
        setStage("totp");
        return;
      }

      push("Signed in as Super Admin.", "success");
      const basePath = typeof window !== "undefined" ? window.location.pathname.split("/")[1] : "superadmin";
      router.push(`/${basePath}/departments`);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--color-surface-subtle)] px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 text-center">
          <Badge tone="danger">Restricted Access</Badge>
          <p className="mt-2 font-[var(--font-display)] text-[20px] font-bold text-[var(--color-ink)]">
            Super Admin Portal
          </p>
          <p className="mt-1 text-[13.5px] text-[var(--color-ink-subtle)]">
            {stage === "credentials" ? "Sign in with your master credentials" : "Enter your 2FA authenticator code"}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-sm)]"
        >
          {stage === "credentials" ? (
            <div className="flex flex-col gap-4">
              <Input
                label="Super Admin Email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Input
                label="6-digit authenticator code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                autoFocus
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                hint="From your Google Authenticator or Apple Passwords."
              />
            </div>
          )}

          {error && (
            <p role="alert" className="mt-3 text-[13px] text-[var(--color-danger)]">
              {error}
            </p>
          )}

          <Button type="submit" className="mt-5 w-full" loading={loading}>
            {stage === "credentials" ? "Continue" : "Sign in to Control Center"}
          </Button>

          {stage === "totp" && (
            <button
              type="button"
              onClick={() => setStage("credentials")}
              className="mt-3 w-full text-center text-[12.5px] text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)]"
            >
              Back
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
