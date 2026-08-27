"use client";

import { useRouter as useNextRouter } from "next/navigation";

export function toPortalPath(path: string): string {
  if (typeof window === "undefined") return path;
  const currentFirstSegment = window.location.pathname.split("/")[1] || "";
  if (!currentFirstSegment) return path;

  if (path.startsWith("/teacher/") || path === "/teacher") {
    return path.replace(/^\/teacher/, `/${currentFirstSegment}`);
  }
  if (path.startsWith("/admin/") || path === "/admin") {
    return path.replace(/^\/admin/, `/${currentFirstSegment}`);
  }
  if (path.startsWith("/superadmin/") || path === "/superadmin") {
    return path.replace(/^\/superadmin/, `/${currentFirstSegment}`);
  }
  return path;
}

export function usePortalRouter() {
  const router = useNextRouter();

  return {
    ...router,
    push: (url: string, options?: any) => {
      router.push(toPortalPath(url), options);
    },
    replace: (url: string, options?: any) => {
      router.replace(toPortalPath(url), options);
    },
  };
}
