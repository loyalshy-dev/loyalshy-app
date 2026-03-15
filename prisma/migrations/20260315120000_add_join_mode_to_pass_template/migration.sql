-- CreateEnum
CREATE TYPE "join_mode" AS ENUM ('open', 'invite_only');

-- AlterTable
ALTER TABLE "pass_template" ADD COLUMN "joinMode" "join_mode" NOT NULL DEFAULT 'open';

-- Set sensible defaults: INVITE_ONLY for pass types that shouldn't be self-joined
UPDATE "pass_template" SET "joinMode" = 'invite_only'
WHERE "passType" IN ('ticket', 'access', 'transit', 'business_id', 'gift_card', 'prepaid');
