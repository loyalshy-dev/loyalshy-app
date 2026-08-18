-- Third org role: "admin" (program manager) — design studio, distribution,
-- and program lifecycle without billing/team/org-settings access. Used for
-- partner reps post-handoff and invitable by owners. Hand-written
-- (shadow-DB validation still trips on post_pivot_drift); applied via
-- `prisma migrate deploy`.

-- AlterEnum
ALTER TYPE "staff_role" ADD VALUE 'admin';
