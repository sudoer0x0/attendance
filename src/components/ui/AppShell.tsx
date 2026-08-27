"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useCurrentProfile } from "@/lib/auth/useCurrentProfile";
import { Badge } from "@/components/ui/Badge";

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
      {/* Sidebar — 260px per standard SaaS density convention */}
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

        <div className="border-t border-[var(--color-border)] px-4 py-3">
          <p className="truncate text-[12.5px] font-medium text-[var(--color-ink)]">
            {profile?.displayName ?? userLabel ?? "Authenticated User"}
          </p>
          {profile?.email && (
            <p className="truncate text-[11.5px] text-[var(--color-ink-subtle)]">{profile.email}</p>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-white px-4 md:hidden">
          <div className="flex items-center gap-2">
            <span className="font-[var(--font-display)] text-[14.5px] font-bold text-[var(--color-ink)]">
              {displayOrg}
            </span>
            {profile?.departmentCode && (
              <span className="rounded bg-[var(--color-accent-subtle)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--color-accent-ink)]">
                {profile.departmentCode}
              </span>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-white px-4 py-4 md:px-6">
      <div>
        <h1 className="font-[var(--font-display)] text-[18px] font-bold text-[var(--color-ink)]">
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 text-[13px] text-[var(--color-ink-subtle)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
