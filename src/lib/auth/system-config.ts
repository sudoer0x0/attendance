import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

/**
 * Login routes call this instead of reading process.env directly for the
 * three settings that are now genuinely Super-Admin-tunable (see
 * src/app/api/system-config/route.ts's scope note for which settings
 * this covers and which it deliberately doesn't yet).
 *
 * Cached in Redis for 30s so a login-heavy period (start of a class,
 * everyone signing in at once) doesn't turn into a Postgres query per
 * request — this is exactly the kind of read where a short staleness
 * window is a completely reasonable tradeoff: if a Super Admin changes
 * the lockout duration, it takes effect within 30 seconds, not instantly,
 * which is fine for a setting like this.
 */

interface LoginSecurityConfig {
  studentLoginCooldownHours: number;
  loginMaxAttempts: number;
  loginLockoutMinutes: number;
}

const CACHE_KEY = "system_config:login_security";
const CACHE_TTL_SECONDS = 30;

const ENV_FALLBACKS: LoginSecurityConfig = {
  studentLoginCooldownHours: Number(process.env.STUDENT_LOGIN_COOLDOWN_HOURS ?? 2),
  loginMaxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5),
  loginLockoutMinutes: Number(process.env.LOGIN_LOCKOUT_MINUTES ?? 15),
};

export async function getLoginSecurityConfig(): Promise<LoginSecurityConfig> {
  const cached = await redis.get<string>(CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached) as LoginSecurityConfig;
    } catch {
      // Malformed cache entry (shouldn't happen, but fail open to a fresh
      // DB read rather than crashing a login request over a cache bug).
    }
  }

  // No row yet (Super Admin has never opened Settings) → env var
  // defaults, so behavior is identical to before this feature existed.
  const row = await db.systemConfig.findUnique({ where: { id: "singleton" } });
  const config: LoginSecurityConfig = row
    ? {
        studentLoginCooldownHours: row.studentLoginCooldownHours,
        loginMaxAttempts: row.loginMaxAttempts,
        loginLockoutMinutes: row.loginLockoutMinutes,
      }
    : ENV_FALLBACKS;

  await redis.set(CACHE_KEY, JSON.stringify(config), { ex: CACHE_TTL_SECONDS });
  return config;
}
