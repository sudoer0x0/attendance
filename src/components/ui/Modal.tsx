"use client";

import { ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg sm:max-w-xl" };

export function Modal({ open, onClose, title, description, children, footer, size = "md" }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        className="fixed inset-0 bg-[var(--color-ink)]/50 backdrop-blur-xs animate-[fadeIn_120ms_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={cn(
          "relative my-auto w-full max-h-[92vh] flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-xl",
          "animate-[slideUp_150ms_ease-out] focus:outline-none",
          sizeClasses[size]
        )}
      >
        <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id="modal-title" className="text-[15px] font-semibold text-[var(--color-ink)]">
                {title}
              </h2>
              {description && (
                <p className="mt-0.5 text-[12.5px] text-[var(--color-ink-subtle)]">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-[var(--color-ink-subtle)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-ink)]"
              aria-label="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && (
          <div className="shrink-0 flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3 sm:px-5 sm:py-3.5 bg-[var(--color-surface-subtle)]/40 rounded-b-[var(--radius-lg)]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
