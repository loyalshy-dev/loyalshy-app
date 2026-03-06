-- AlterEnum
ALTER TYPE "card_type" ADD VALUE 'prepaid';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "enrollment_status" ADD VALUE 'suspended';
ALTER TYPE "enrollment_status" ADD VALUE 'expired';

-- AlterEnum
ALTER TYPE "program_type" ADD VALUE 'prepaid';

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
ALTER TABLE "enrollment" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "remainingUses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

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
ALTER TABLE "showcase_card" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

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

-- AlterTable
ALTER TABLE "webhook_event" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;
