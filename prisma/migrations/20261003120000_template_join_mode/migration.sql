-- Private programs: a template is PUBLIC (anyone joins via /join — QR, link,
-- NFC) or INVITE_ONLY (only the team issues passes: dashboard direct issue
-- by email, staff-app counter signup). Existing programs stay public.

-- CreateEnum
CREATE TYPE "join_mode" AS ENUM ('public', 'invite_only');

-- AlterTable
ALTER TABLE "pass_template" ADD COLUMN "joinMode" "join_mode" NOT NULL DEFAULT 'public';
