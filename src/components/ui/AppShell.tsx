"use client";

import { ReactNode, useState } from "react";
import { cn } from "@/lib/cn";
import { useCurrentProfile } from "@/lib/auth/useCurrentProfile";

interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
  active?: boolean;
}

export function AppShell({
  navItems,
  orgLabel = "Attend",
  userLabel,
  children,
}: {
  navItems: NavItem[];
  orgLabel?: string;
  userLabel?: string;
  children: ReactNode;
}) {
  const { profile } = useCurrentProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentFirstSegment = typeof window !== "undefined" ? window.location.pathname.split("/")[1] : "";

  function resolveHref(href: string) {
    if (!currentFirstSegment) return href;
    if (href.startsWith("/superadmin/") || href === "/superadmin") {
      return href.replace(/^\/superadmin/, `/${currentFirstSegment}`);
    }
    if (href.startsWith("/admin/") || href === "/admin") {
      return href.replace(/^\/admin/, `/${currentFirstSegment}`);
    }
    if (href.startsWith("/teacher/") || href === "/teacher") {
      return href.replace(/^\/teacher/, `/${currentFirstSegment}`);
    }
    return href;
  }

  async function handleSignOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      const loginUrl =
        profile?.role === "SUPER_ADMIN"
          ? `/${currentFirstSegment || "superadmin"}/login`
          : profile?.role === "DEPARTMENT_ADMIN"
          ? `/${currentFirstSegment || "admin"}/login`
          : profile?.role === "TEACHER"
          ? `/${currentFirstSegment || "staff"}/login`
          : "/student/login";
      window.location.href = loginUrl;
    }
  }

  const displayOrg = profile?.departmentName ?? orgLabel;
  const displayRoleSubtitle =
    profile?.role === "SUPER_ADMIN"
      ? "Super Admin Control"
      : profile?.role === "DEPARTMENT_ADMIN"
      ? `${profile.departmentCode ? `${profile.departmentCode} ` : ""}Department Admin`
      : profile?.role === "TEACHER"
      ? `${profile.departmentCode ? `${profile.departmentCode} ` : ""}Faculty Staff`
      : undefined;

  return (
    <div className="flex min-h-dvh bg-[var(--color-surface-subtle)]">
      {/* Desktop Sidebar — 260px */}
      <aside className="hidden w-[260px] shrink-0 flex-col border-r border-[var(--color-border)] bg-white md:flex">
        <div className="flex min-h-14 items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <div className="min-w-0">
            <span className="block truncate font-[var(--font-display)] text-[14.5px] font-bold text-[var(--color-ink)]">
              {displayOrg}
            </span>
            {displayRoleSubtitle && (
              <span className="block truncate text-[11px] font-medium text-[var(--color-accent)]">
                {displayRoleSubtitle}
              </span>
            )}
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-2.5 py-3">
          {navItems.map((item) => {
            const finalHref = resolveHref(item.href);
            return (
              <a
                key={item.href}
                href={finalHref}
                className={cn(
                  "flex items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-[13.5px] font-medium transition-colors duration-100",
                  item.active
                    ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent-ink)]"
                    : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
                )}
                aria-current={item.active ? "page" : undefined}
              >
                {item.icon}
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium text-[var(--color-ink)]">
              {profile?.displayName ?? userLabel ?? "Authenticated User"}
            </p>
            {profile?.email && (
              <p className="truncate text-[11.5px] text-[var(--color-ink-subtle)]">{profile.email}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="ml-2 rounded p-1 text-[var(--color-ink-subtle)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-danger)]"
            title="Sign out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop & Slide-over */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-[var(--color-ink)]/50 backdrop-blur-xs animate-[fadeIn_120ms_ease-out]"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative flex w-[280px] max-w-[85vw] flex-1 flex-col bg-white shadow-2xl animate-[slideRight_150ms_ease-out]">
            <div className="flex h-14 items-center justify-between border-b border-[var(--color-border)] px-4">
              <div className="min-w-0">
                <span className="block truncate font-[var(--font-display)] text-[14.5px] font-bold text-[var(--color-ink)]">
                  {displayOrg}
                </span>
                {displayRoleSubtitle && (
                  <span className="block truncate text-[11px] font-medium text-[var(--color-accent)]">
                    {displayRoleSubtitle}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded p-1 text-[var(--color-ink-subtle)] hover:bg-[var(--color-surface-subtle)]"
                aria-label="Close menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {navItems.map((item) => {
                const finalHref = resolveHref(item.href);
                return (
                  <a
                    key={item.href}
                    href={finalHref}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-[14px] font-medium transition-colors",
                      item.active
                        ? "bg-[var(--color-accent-subtle)] text-[var(--color-accent-ink)] font-semibold"
                        : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </a>
                );
              })}
            </nav>

            <div className="border-t border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]/40">
              <p className="truncate text-[13px] font-medium text-[var(--color-ink)]">
                {profile?.displayName ?? userLabel ?? "Authenticated User"}
              </p>
              {profile?.email && (
                <p className="truncate text-[11.5px] text-[var(--color-ink-subtle)]">{profile.email}</p>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white py-2 text-[13px] font-medium text-[var(--color-danger)] shadow-xs hover:bg-[var(--color-danger)]/5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col pb-14 md:pb-0">
        {/* Mobile Top Bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-white px-4 md:hidden">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded p-1.5 text-[var(--color-ink-subtle)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-ink)]"
              aria-label="Open navigation menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </button>
            <div className="min-w-0">
              <span className="block truncate font-[var(--font-display)] text-[14.5px] font-bold text-[var(--color-ink)]">
                {displayOrg}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {profile?.departmentCode && (
              <span className="rounded bg-[var(--color-accent-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-accent-ink)]">
                {profile.departmentCode}
              </span>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded p-1.5 text-[var(--color-ink-subtle)] hover:text-[var(--color-danger)]"
              title="Sign out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>

        {/* Mobile Bottom Navigation Bar */}
        {navItems.length > 1 && navItems.length <= 5 && (
          <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-14 items-center justify-around border-t border-[var(--color-border)] bg-white/95 px-2 backdrop-blur-md md:hidden shadow-lg">
            {navItems.map((item) => {
              const finalHref = resolveHref(item.href);
              return (
                <a
                  key={item.href}
                  href={finalHref}
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center py-1 text-center transition-colors",
                    item.active
                      ? "text-[var(--color-accent-ink)] font-bold"
                      : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                  )}
                  aria-current={item.active ? "page" : undefined}
                >
                  <span className="text-[11px] leading-tight truncate max-w-[80px]">
                    {item.label}
                  </span>
                  {item.active && (
                    <span className="mt-0.5 h-1 w-4 rounded-full bg-[var(--color-accent)]" />
                  )}
                </a>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--color-border)] bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
      <div className="min-w-0">
        <h1 className="font-[var(--font-display)] text-[18px] font-bold text-[var(--color-ink)] sm:text-[20px]">
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 text-[12.5px] text-[var(--color-ink-subtle)] sm:text-[13px]">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
