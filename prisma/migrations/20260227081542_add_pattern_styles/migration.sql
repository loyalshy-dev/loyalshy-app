-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "pattern_style" ADD VALUE 'chevron';
ALTER TYPE "pattern_style" ADD VALUE 'crosshatch';
ALTER TYPE "pattern_style" ADD VALUE 'diamonds';
ALTER TYPE "pattern_style" ADD VALUE 'confetti';
ALTER TYPE "pattern_style" ADD VALUE 'solid_primary';
ALTER TYPE "pattern_style" ADD VALUE 'solid_secondary';

-- AlterTable
ALTER TABLE "account" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "analytics_snapshot" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "card_design" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "customer" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "device_registration" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "invitation" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "loyalty_program" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "member" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "organization" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "restaurant" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "reward" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "session" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "staff_invitation" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "verification" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "visit" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "wallet_pass_log" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;
