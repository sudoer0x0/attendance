"use client";

import { usePathname, useRouter as useNextRouter } from "next/navigation";

/**
 * Returns the active root segment from the pathname (e.g. "superadmin-portal-44z", "admin-portal-99x", "staff-portal-55k", "student").
 */
export function getPortalBase(pathname?: string): string {
  if (pathname) {
    return pathname.split("/")[1] || "";
  }
  if (typeof window !== "undefined") {
    return window.location.pathname.split("/")[1] || "";
  }
  return "";
}

/**
 * Converts generic internal paths like /superadmin/settings, /admin/students, /teacher/courses
 * into their corresponding secret or mounted portal URL based on the current window or pathname.
 */
export function toPortalPath(path: string, currentPathname?: string): string {
  const firstSegment = getPortalBase(currentPathname);
  if (!firstSegment) return path;

  // Mask /superadmin routes with active secret prefix
  if (path.startsWith("/superadmin/") || path === "/superadmin") {
    return path.replace(/^\/superadmin/, `/${firstSegment}`);
  }
  // Mask /admin routes with active secret prefix
  if (path.startsWith("/admin/") || path === "/admin") {
    return path.replace(/^\/admin/, `/${firstSegment}`);
  }
  // Mask /teacher routes with active secret prefix
  if (path.startsWith("/teacher/") || path === "/teacher") {
    return path.replace(/^\/teacher/, `/${firstSegment}`);
  }
  return path;
}

export function usePortalRouter() {
  const router = useNextRouter();
  const pathname = usePathname();

  return {
    ...router,
    push: (url: string, options?: Parameters<typeof router.push>[1]) => {
      router.push(toPortalPath(url, pathname), options);
    },
    replace: (url: string, options?: Parameters<typeof router.replace>[1]) => {
      router.replace(toPortalPath(url, pathname), options);
    },
  };
}
