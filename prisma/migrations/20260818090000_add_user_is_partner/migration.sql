-- Partner seat exemption: platform-controlled flag on users (agency/partner
-- reps). Members whose user isPartner are excluded from plan staffLimit
-- counting and gating. Hand-written (shadow-DB validation still trips on
-- post_pivot_drift); applied via `prisma migrate deploy`.

-- AlterEnum
ALTER TYPE "admin_action" ADD VALUE 'user_partner_changed';

-- AlterTable
ALTER TABLE "user" ADD COLUMN "isPartner" BOOLEAN NOT NULL DEFAULT false;
