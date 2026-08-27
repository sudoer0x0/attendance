import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession, UnauthorizedError, ForbiddenError } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/auth/audit";

/**
 * Singleton row (id: "singleton", enforced by the schema's @default value
 * plus this route only ever reading/writing that one id). GET upserts a
 * default row into existence on first access rather than requiring a
 * separate seed step — the values here fall back to the same defaults the
 * env vars use, so a fresh deploy behaves identically whether or not
 * anyone has opened this page yet.
 *
 * Scope note (see HANDOFF.md): studentLoginCooldownHours,
 * loginMaxAttempts, and loginLockoutMinutes are read from THIS table by
 * the login routes (see src/lib/auth/system-config.ts) — genuinely live-
 * editable without a redeploy. qrRotationSeconds is stored here too but
 * NOT yet actually consumed anywhere; the QR engine still reads
 * QR_ROTATION_SECONDS from the environment. Making that one live would
 * also require the teacher's client-side countdown-ring interval to be
 * dynamic rather than hardcoded, which is more than this pass covers —
 * the settings page shows it as read-only with a clear note rather than
 * silently pretending to control something it doesn't.
 */

const DEFAULTS = {
  id: "singleton",
  schoolName: "My School",
  qrRotationSeconds: 5,
  studentLoginCooldownHours: 2,
  loginMaxAttempts: 5,
  loginLockoutMinutes: 15,
};

export async function GET(req: NextRequest) {
  try {
    await requireSession(req, ["SUPER_ADMIN"]);
    const config = await db.systemConfig.upsert({
      where: { id: "singleton" },
      update: {},
      create: DEFAULTS,
    });
    return NextResponse.json(config);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}

const updateSchema = z.object({
  schoolName: z.string().min(1).optional(),
  schoolLogoUrl: z.string().url().optional().or(z.literal("")),
  studentLoginCooldownHours: z.number().int().min(0).max(72).optional(),
  loginMaxAttempts: z.number().int().min(1).max(50).optional(),
  loginLockoutMinutes: z.number().int().min(1).max(1440).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const claims = await requireSession(req, ["SUPER_ADMIN"]);
    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const config = await db.systemConfig.upsert({
      where: { id: "singleton" },
      update: parsed.data,
      create: { ...DEFAULTS, ...parsed.data },
    });

    await writeAuditLog({
      actorRole: "SUPER_ADMIN",
      actorId: claims.sub,
      action: "system_config.updated",
      metadata: parsed.data,
    });

    return NextResponse.json(config);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}
