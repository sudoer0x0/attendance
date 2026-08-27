"use client";

import { createContext, useCallback, useContext, useState, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

type ToastTone = "neutral" | "success" | "danger";
interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<{ push: (message: string, tone?: ToastTone) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const toneClasses: Record<ToastTone, string> = {
  neutral: "border-[var(--color-border)] bg-white text-[var(--color-ink)]",
  success: "border-[var(--color-success)]/30 bg-[var(--color-success-subtle)] text-[var(--color-success-ink)]",
  danger: "border-[var(--color-danger)]/30 bg-[var(--color-danger-subtle)] text-[var(--color-danger-ink)]",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const push = useCallback((message: string, tone: ToastTone = "neutral") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      {typeof window !== "undefined" &&
        mounted &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2" role="status" aria-live="polite">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "rounded-[var(--radius-md)] border px-3.5 py-2.5 text-[13px] font-medium shadow-[var(--shadow-md)]",
                  "animate-[slideUp_150ms_ease-out]",
                  toneClasses[t.tone]
                )}
              >
                {t.message}
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
