-- Enforces AuditLog append-only-ness at the database level, per design
-- doc §10 and HANDOFF.md §12 gap: the app-layer code (writeAuditLog in
-- src/lib/auth/audit.ts) never calls UPDATE or DELETE on this table, but
-- that's a convention, not a guarantee — a bug or a compromised app-layer
-- credential could still issue one. This closes that gap at the actual
-- database permission level.
--
-- NOT a Prisma migration — deliberately run manually, once, outside
-- `prisma migrate`. Reasoning: this revokes privileges from the SAME
-- role Prisma connects as, which needs to be run by a role with elevated
-- privileges (the Supabase project owner / postgres role), not the
-- app's normal runtime connection. Folding this into the regular
-- migration flow would be confusing about which role runs it.
--
-- HOW TO RUN (Supabase): paste this into the SQL Editor in your Supabase
-- dashboard (runs as an elevated role there) and execute once, after
-- your first `prisma migrate deploy` has created the AuditLog table.
--
-- Replace `app_user` below with your actual Prisma connection role name
-- if it differs — for Supabase's default setup this is typically
-- `postgres` for the direct connection or a role you've created
-- specifically for the app; check your DATABASE_URL's username.

REVOKE UPDATE, DELETE ON "AuditLog" FROM app_user;

-- INSERT and SELECT remain allowed (writing new entries, reading the
-- audit log UI) — only UPDATE/DELETE are blocked. Verify this worked:
--   SELECT grantee, privilege_type FROM information_schema.role_table_grants
--   WHERE table_name = 'AuditLog';
-- should show no UPDATE/DELETE row for app_user.
