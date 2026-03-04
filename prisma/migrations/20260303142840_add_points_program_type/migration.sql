-- AlterEnum
ALTER TYPE "program_type" ADD VALUE 'points';

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
ALTER TABLE "enrollment" ADD COLUMN     "pointsBalance" INTEGER NOT NULL DEFAULT 0,
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
ALTER TABLE "reward" ADD COLUMN     "description" TEXT,
ADD COLUMN     "pointsCost" INTEGER,
ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

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
