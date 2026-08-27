import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "success" | "danger" | "warning";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]",
  accent: "bg-[var(--color-accent-subtle)] text-[var(--color-accent-ink)]",
  success: "bg-[var(--color-success-subtle)] text-[var(--color-success-ink)]",
  danger: "bg-[var(--color-danger-subtle)] text-[var(--color-danger-ink)]",
  warning: "bg-[var(--color-warning-subtle)] text-[var(--color-warning-ink)]",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

export function Badge({ className, tone = "neutral", dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-0.5 text-[12px] font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    >
      {dot && <span className="size-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}
