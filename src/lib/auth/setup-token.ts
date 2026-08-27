import { randomBytes } from "crypto";
import { redis } from "@/lib/redis";

const TTL_SECONDS = 600; // 10 minutes — long enough to complete setup, short enough to limit exposure

export type SetupSubjectType = "STUDENT" | "TEACHER" | "DEPARTMENT_ADMIN";

/**
 * Bridges first-login identity verification to password/device setup, for
 * both the student flow (§4) and the staff Teacher/Departmental Admin flow
 * (§9). subjectType is embedded so a single token format can serve both —
 * a Super Admin never goes through this flow (created once via CLI, see
 * scripts/setup-super-admin.ts), so only these three types apply.
 */
export async function issueSetupToken(subjectType: SetupSubjectType, subjectId: string): Promise<string> {
  const token = randomBytes(24).toString("hex");
  await redis.set(`setup_token:${token}`, `${subjectType}:${subjectId}`, { ex: TTL_SECONDS });
  return token;
}

export async function consumeSetupToken(
  token: string
): Promise<{ subjectType: SetupSubjectType; subjectId: string } | null> {
  const key = `setup_token:${token}`;
  const value = await redis.get<string>(key);
  if (!value) return null;
  await redis.del(key); // single-use

  const [subjectType, subjectId] = value.split(":") as [SetupSubjectType, string];
  return { subjectType, subjectId };
}
