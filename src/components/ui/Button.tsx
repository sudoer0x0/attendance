import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-white border border-[var(--color-accent)] " +
    "hover:bg-[var(--color-accent-hover)] hover:border-[var(--color-accent-hover)] " +
    "active:bg-[var(--color-accent-ink)] " +
    "disabled:bg-[var(--color-border)] disabled:border-[var(--color-border)] disabled:text-[var(--color-ink-subtle)]",
  secondary:
    "bg-white text-[var(--color-ink)] border border-[var(--color-border-strong)] " +
    "hover:bg-[var(--color-surface-muted)] active:bg-[var(--color-border)] " +
    "disabled:bg-[var(--color-surface-subtle)] disabled:text-[var(--color-ink-subtle)] disabled:border-[var(--color-border)]",
  ghost:
    "bg-transparent text-[var(--color-ink-muted)] border border-transparent " +
    "hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] active:bg-[var(--color-border)] " +
    "disabled:text-[var(--color-ink-subtle)]",
  danger:
    "bg-[var(--color-danger)] text-white border border-[var(--color-danger)] " +
    "hover:bg-[var(--color-danger-ink)] hover:border-[var(--color-danger-ink)] " +
    "disabled:bg-[var(--color-border)] disabled:border-[var(--color-border)] disabled:text-[var(--color-ink-subtle)]",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-[var(--radius-md)] font-medium",
          "transition-colors duration-100 cursor-pointer select-none",
          "disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && <Spinner className="size-3.5" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
