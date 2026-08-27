"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

type Mode = "returning" | "first-time";
type FirstTimeStage = "verify" | "password";

export default function StudentLoginPage() {
  const router = useRouter();
  const { push } = useToast();
  const [mode, setMode] = useState<Mode>("returning");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Shared fields
  const [matricNo, setMatricNo] = useState("");
  const [surname, setSurname] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ftStage, setFtStage] = useState<FirstTimeStage>("verify");
  const [setupToken, setSetupToken] = useState<string | null>(null);

  async function handleReturningLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matricNo, surname, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      push("Signed in successfully.", "success");
      router.push("/student/dashboard");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFirstTimeVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/student/first-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matricNo, surname, dateOfBirth }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not verify your details.");
        return;
      }
      setSetupToken(data.setupToken);
      setFtStage("password");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFirstTimePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please re-enter them.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/student/complete-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not set your password.");
        return;
      }

      push("Account set up successfully.", "success");
      router.push("/student/dashboard");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--color-surface-subtle)] px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 text-center">
          <p className="font-[var(--font-display)] text-[20px] font-bold text-[var(--color-ink)]">
            Attend
          </p>
          <p className="mt-1 text-[13.5px] text-[var(--color-ink-subtle)]">
            {mode === "returning"
              ? "Sign in with your matric number"
              : ftStage === "verify"
                ? "First time here? Let's verify your details"
                : "Create a password for your account"}
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-sm)]">
          {mode === "returning" ? (
            <form onSubmit={handleReturningLogin} className="flex flex-col gap-4">
              <Input label="Matric number" required value={matricNo} onChange={(e) => setMatricNo(e.target.value)} />
              <Input label="Surname" required value={surname} onChange={(e) => setSurname(e.target.value)} />
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <p role="alert" className="text-[13px] text-[var(--color-danger)]">{error}</p>}
              <Button type="submit" loading={loading}>
                Sign in
              </Button>
            </form>
          ) : ftStage === "verify" ? (
            <form onSubmit={handleFirstTimeVerify} className="flex flex-col gap-4">
              <Input label="Matric number" required value={matricNo} onChange={(e) => setMatricNo(e.target.value)} />
              <Input label="Surname" required value={surname} onChange={(e) => setSurname(e.target.value)} />
              <Input
                label="Date of birth"
                type="date"
                required
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                hint="As it appears on your department's records."
              />
              {error && <p role="alert" className="text-[13px] text-[var(--color-danger)]">{error}</p>}
              <Button type="submit" loading={loading}>
                Continue
              </Button>
            </form>
          ) : (
            <form onSubmit={handleFirstTimePassword} className="flex flex-col gap-4">
              <Input
                label="Create a password"
                type="password"
                required
                minLength={10}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                hint="At least 10 characters."
              />
              <Input
                label="Confirm password"
                type="password"
                required
                minLength={10}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {error && <p role="alert" className="text-[13px] text-[var(--color-danger)]">{error}</p>}
              <Button type="submit" loading={loading}>
                Set password &amp; sign in
              </Button>
            </form>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "returning" ? "first-time" : "returning");
            setError(null);
            setFtStage("verify");
          }}
          className="mt-5 w-full text-center text-[12.5px] font-medium text-[var(--color-accent)] hover:underline"
        >
          {mode === "returning" ? "First time signing in? Set up your account" : "Already set up? Sign in"}
        </button>
      </div>
    </div>
  );
}
