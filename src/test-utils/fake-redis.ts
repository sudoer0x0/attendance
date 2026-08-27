/**
 * A minimal in-memory stand-in for @upstash/redis, covering only the
 * operations this project actually uses (see grep for `redis.` across
 * src/lib and src/app/api). Used in tests via vi.mock("@/lib/redis", ...)
 * so token.ts's redemption logic can be exercised without a real Redis
 * instance or network access.
 *
 * Critically for the one-time-redemption race-condition test: `set` with
 * `{ nx: true }` does its "does the key exist / set it" check as plain
 * synchronous Map operations with NO `await` in between. In Node's
 * single-threaded event loop, that means once this function starts
 * running, it runs to completion before any other queued microtask
 * (including a concurrent call to this same function) gets a turn — which
 * is exactly the atomicity property real Redis's SET NX provides via a
 * single-threaded command execution model. This makes the fake a faithful
 * enough model of the real guarantee for testing the *application logic*
 * that depends on it, even though it obviously isn't testing Redis itself.
 */
export class FakeRedis {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  async set(
    key: string,
    value: string,
    opts?: { nx?: boolean; ex?: number }
  ): Promise<string | null> {
    this.evictIfExpired(key);

    if (opts?.nx && this.store.has(key)) {
      return null; // key already exists — this is the "already used" case
    }

    const expiresAt = opts?.ex ? Date.now() + opts.ex * 1000 : null;
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async get<T = string>(key: string): Promise<T | null> {
    this.evictIfExpired(key);
    const entry = this.store.get(key);
    return (entry?.value as T) ?? null;
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    this.evictIfExpired(key);
    const entry = this.store.get(key);
    const next = (entry ? Number(entry.value) : 0) + 1;
    this.store.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  /** Test helper, not part of the real Redis client's API. */
  _size(): number {
    return this.store.size;
  }

  private evictIfExpired(key: string) {
    const entry = this.store.get(key);
    if (entry?.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
    }
  }
}
