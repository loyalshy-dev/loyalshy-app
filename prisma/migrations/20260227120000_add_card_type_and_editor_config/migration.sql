-- CreateEnum
CREATE TYPE "card_type" AS ENUM ('stamp', 'points', 'tier', 'coupon');

-- AlterTable
ALTER TABLE "card_design" ADD COLUMN "cardType" "card_type" NOT NULL DEFAULT 'stamp';
ALTER TABLE "card_design" ADD COLUMN "editorConfig" JSONB NOT NULL DEFAULT '{}';
