/*
  Warnings:

  - The values [free] on the enum `plan` will be removed. If these variants are still used in the database, this will fail.
  - The values [free] on the enum `subscription_status` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `restaurantId` on the `card_design` table. All the data in the column will be lost.
  - You are about to drop the column `currentCycleVisits` on the `customer` table. All the data in the column will be lost.
  - You are about to drop the column `totalRewardsRedeemed` on the `customer` table. All the data in the column will be lost.
  - You are about to drop the column `walletPassId` on the `customer` table. All the data in the column will be lost.
  - You are about to drop the column `walletPassSerialNumber` on the `customer` table. All the data in the column will be lost.
  - You are about to drop the column `walletPassType` on the `customer` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `loyalty_program` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[loyaltyProgramId]` on the table `card_design` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `loyaltyProgramId` to the `card_design` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "enrollment_status" AS ENUM ('active', 'completed', 'frozen');

-- CreateEnum
CREATE TYPE "program_status" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "program_type" AS ENUM ('stamp_card', 'coupon', 'membership');

-- AlterEnum
BEGIN;
CREATE TYPE "plan_new" AS ENUM ('starter', 'pro', 'business', 'enterprise');
ALTER TABLE "public"."restaurant" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "restaurant" ALTER COLUMN "plan" TYPE "plan_new" USING ("plan"::text::"plan_new");
ALTER TYPE "plan" RENAME TO "plan_old";
ALTER TYPE "plan_new" RENAME TO "plan";
DROP TYPE "public"."plan_old";
ALTER TABLE "restaurant" ALTER COLUMN "plan" SET DEFAULT 'starter';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "subscription_status_new" AS ENUM ('trialing', 'active', 'past_due', 'canceled');
ALTER TABLE "public"."restaurant" ALTER COLUMN "subscriptionStatus" DROP DEFAULT;
ALTER TABLE "restaurant" ALTER COLUMN "subscriptionStatus" TYPE "subscription_status_new" USING ("subscriptionStatus"::text::"subscription_status_new");
ALTER TYPE "subscription_status" RENAME TO "subscription_status_old";
ALTER TYPE "subscription_status_new" RENAME TO "subscription_status";
DROP TYPE "public"."subscription_status_old";
ALTER TABLE "restaurant" ALTER COLUMN "subscriptionStatus" SET DEFAULT 'trialing';
COMMIT;

-- DropForeignKey
ALTER TABLE "card_design" DROP CONSTRAINT "card_design_restaurantId_fkey";

-- DropForeignKey
ALTER TABLE "device_registration" DROP CONSTRAINT "device_registration_serialNumber_fkey";

-- DropForeignKey
ALTER TABLE "wallet_pass_log" DROP CONSTRAINT "wallet_pass_log_customerId_fkey";

-- DropIndex
DROP INDEX "card_design_restaurantId_key";

-- DropIndex
DROP INDEX "customer_walletPassId_key";

-- DropIndex
DROP INDEX "customer_walletPassSerialNumber_idx";

-- DropIndex
DROP INDEX "customer_walletPassSerialNumber_key";

-- DropIndex
DROP INDEX "wallet_pass_log_customerId_idx";

-- AlterTable
ALTER TABLE "account" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "analytics_snapshot" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "card_design" DROP COLUMN "restaurantId",
ADD COLUMN     "loyaltyProgramId" TEXT NOT NULL,
ADD COLUMN     "mapLatitude" DOUBLE PRECISION,
ADD COLUMN     "mapLongitude" DOUBLE PRECISION,
ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "customer" DROP COLUMN "currentCycleVisits",
DROP COLUMN "totalRewardsRedeemed",
DROP COLUMN "walletPassId",
DROP COLUMN "walletPassSerialNumber",
DROP COLUMN "walletPassType",
ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "device_registration" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "invitation" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "loyalty_program" DROP COLUMN "isActive",
ADD COLUMN     "config" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "programType" "program_type" NOT NULL DEFAULT 'stamp_card',
ADD COLUMN     "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "program_status" NOT NULL DEFAULT 'active',
ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "member" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "organization" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "restaurant" ADD COLUMN     "logoApple" TEXT,
ADD COLUMN     "logoGoogle" TEXT,
ALTER COLUMN "id" SET DEFAULT uuidv7()::text,
ALTER COLUMN "subscriptionStatus" SET DEFAULT 'trialing',
ALTER COLUMN "plan" SET DEFAULT 'starter';

-- AlterTable
ALTER TABLE "reward" ADD COLUMN     "enrollmentId" TEXT,
ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "session" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "staff_invitation" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "verification" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "visit" ADD COLUMN     "enrollmentId" TEXT,
ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "wallet_pass_log" ADD COLUMN     "enrollmentId" TEXT,
ALTER COLUMN "id" SET DEFAULT uuidv7()::text,
ALTER COLUMN "customerId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "enrollment" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "customerId" TEXT NOT NULL,
    "loyaltyProgramId" TEXT NOT NULL,
    "currentCycleVisits" INTEGER NOT NULL DEFAULT 0,
    "totalVisits" INTEGER NOT NULL DEFAULT 0,
    "totalRewardsRedeemed" INTEGER NOT NULL DEFAULT 0,
    "walletPassId" TEXT,
    "walletPassSerialNumber" TEXT,
    "walletPassType" "wallet_pass_type" NOT NULL DEFAULT 'none',
    "status" "enrollment_status" NOT NULL DEFAULT 'active',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "frozenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_event" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "showcase_card" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "designData" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "showcase_card_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_walletPassId_key" ON "enrollment"("walletPassId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_walletPassSerialNumber_key" ON "enrollment"("walletPassSerialNumber");

-- CreateIndex
CREATE INDEX "enrollment_customerId_idx" ON "enrollment"("customerId");

-- CreateIndex
CREATE INDEX "enrollment_loyaltyProgramId_idx" ON "enrollment"("loyaltyProgramId");

-- CreateIndex
CREATE INDEX "enrollment_walletPassSerialNumber_idx" ON "enrollment"("walletPassSerialNumber");

-- CreateIndex
CREATE INDEX "enrollment_status_idx" ON "enrollment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_customerId_loyaltyProgramId_key" ON "enrollment"("customerId", "loyaltyProgramId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_event_stripeEventId_key" ON "webhook_event"("stripeEventId");

-- CreateIndex
CREATE INDEX "webhook_event_processedAt_idx" ON "webhook_event"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "card_design_loyaltyProgramId_key" ON "card_design"("loyaltyProgramId");

-- CreateIndex
CREATE INDEX "loyalty_program_restaurantId_status_idx" ON "loyalty_program"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "loyalty_program_restaurantId_programType_idx" ON "loyalty_program"("restaurantId", "programType");

-- CreateIndex
CREATE INDEX "reward_enrollmentId_idx" ON "reward"("enrollmentId");

-- CreateIndex
CREATE INDEX "visit_enrollmentId_idx" ON "visit"("enrollmentId");

-- CreateIndex
CREATE INDEX "wallet_pass_log_enrollmentId_idx" ON "wallet_pass_log"("enrollmentId");

-- AddForeignKey
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_loyaltyProgramId_fkey" FOREIGN KEY ("loyaltyProgramId") REFERENCES "loyalty_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit" ADD CONSTRAINT "visit_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward" ADD CONSTRAINT "reward_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_pass_log" ADD CONSTRAINT "wallet_pass_log_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_registration" ADD CONSTRAINT "device_registration_serialNumber_fkey" FOREIGN KEY ("serialNumber") REFERENCES "enrollment"("walletPassSerialNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_design" ADD CONSTRAINT "card_design_loyaltyProgramId_fkey" FOREIGN KEY ("loyaltyProgramId") REFERENCES "loyalty_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
