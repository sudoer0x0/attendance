"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

export interface UserProfile {
  id: string;
  email?: string;
  fullName?: string;
  displayName: string;
  role: "SUPER_ADMIN" | "DEPARTMENT_ADMIN" | "TEACHER" | "STUDENT";
  departmentName?: string;
  departmentCode?: string;
  department?: { id: string; name: string; code: string };
}

let cachedProfile: UserProfile | null = null;
const listeners = new Set<(profile: UserProfile | null) => void>();

export function useCurrentProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(cachedProfile);
  const [loading, setLoading] = useState(!cachedProfile);

  useEffect(() => {
    let cancelled = false;

    function handleUpdate(p: UserProfile | null) {
      if (!cancelled) setProfile(p);
    }
    listeners.add(handleUpdate);

    if (!cachedProfile) {
      apiFetch("/api/auth/me")
        .then((res) => (res.ok ? res.json() : null))
        .then((data: UserProfile | null) => {
          if (!cancelled && data) {
            cachedProfile = data;
            setProfile(data);
            listeners.forEach((l) => l(data));
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
      listeners.delete(handleUpdate);
    };
  }, []);

  return { profile, loading };
}
