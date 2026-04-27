-- AlterEnum
BEGIN;
CREATE TYPE "design_card_type_new" AS ENUM ('stamp', 'coupon');
ALTER TABLE "public"."pass_design" ALTER COLUMN "cardType" DROP DEFAULT;
ALTER TABLE "pass_design" ALTER COLUMN "cardType" TYPE "design_card_type_new" USING ("cardType"::text::"design_card_type_new");
ALTER TYPE "design_card_type" RENAME TO "design_card_type_old";
ALTER TYPE "design_card_type_new" RENAME TO "design_card_type";
DROP TYPE "public"."design_card_type_old";
ALTER TABLE "pass_design" ALTER COLUMN "cardType" SET DEFAULT 'stamp';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "interaction_type_new" AS ENUM ('stamp', 'coupon_redeem', 'status_change', 'reward_earned', 'reward_redeemed', 'note');
ALTER TABLE "interaction" ALTER COLUMN "type" TYPE "interaction_type_new" USING ("type"::text::"interaction_type_new");
ALTER TYPE "interaction_type" RENAME TO "interaction_type_old";
ALTER TYPE "interaction_type_new" RENAME TO "interaction_type";
DROP TYPE "public"."interaction_type_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "pass_instance_status_new" AS ENUM ('active', 'completed', 'suspended', 'expired', 'revoked');
ALTER TABLE "public"."pass_instance" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "pass_instance" ALTER COLUMN "status" TYPE "pass_instance_status_new" USING ("status"::text::"pass_instance_status_new");
ALTER TYPE "pass_instance_status" RENAME TO "pass_instance_status_old";
ALTER TYPE "pass_instance_status_new" RENAME TO "pass_instance_status";
DROP TYPE "public"."pass_instance_status_old";
ALTER TABLE "pass_instance" ALTER COLUMN "status" SET DEFAULT 'active';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "pass_type_new" AS ENUM ('stamp_card', 'coupon');
ALTER TABLE "pass_template" ALTER COLUMN "passType" TYPE "pass_type_new" USING ("passType"::text::"pass_type_new");
ALTER TYPE "pass_type" RENAME TO "pass_type_old";
ALTER TYPE "pass_type_new" RENAME TO "pass_type";
DROP TYPE "public"."pass_type_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "api_key" DROP CONSTRAINT "api_key_createdById_fkey";

-- DropForeignKey
ALTER TABLE "api_key" DROP CONSTRAINT "api_key_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "api_request_log" DROP CONSTRAINT "api_request_log_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "webhook_delivery" DROP CONSTRAINT "webhook_delivery_webhookEndpointId_fkey";

-- DropForeignKey
ALTER TABLE "webhook_endpoint" DROP CONSTRAINT "webhook_endpoint_organizationId_fkey";

-- AlterTable
ALTER TABLE "account" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "admin_audit_log" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "analytics_snapshot" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "contact" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "device_pairing_token" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "device_registration" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "interaction" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "invitation" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "member" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "organization" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "pass_design" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "pass_instance" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "pass_template" DROP COLUMN "joinMode",
ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "reward" DROP COLUMN "pointsCost",
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
ALTER TABLE "wallet_pass_log" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- AlterTable
ALTER TABLE "webhook_event" ALTER COLUMN "id" SET DEFAULT uuidv7()::text;

-- DropTable
DROP TABLE "api_key";

-- DropTable
DROP TABLE "api_request_log";

-- DropTable
DROP TABLE "platform_config";

-- DropTable
DROP TABLE "webhook_delivery";

-- DropTable
DROP TABLE "webhook_endpoint";

-- DropEnum
DROP TYPE "join_mode";

