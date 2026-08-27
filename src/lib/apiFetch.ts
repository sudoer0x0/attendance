"use client";

/**
 * Drop-in replacement for `fetch` on protected client pages: on a 401, it
 * calls /api/auth/refresh once and retries the original request. If the
 * refresh itself fails (session actually revoked, not just expired), the
 * original 401 is returned as-is so callers' existing error handling
 * still works unchanged.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/auth/refresh", { method: "POST" })
      .then((res) => res.ok)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const first = await fetch(input, init);
  if (first.status !== 401) return first;

  const refreshed = await tryRefresh();
  if (!refreshed) return first;

  return fetch(input, init);
}
