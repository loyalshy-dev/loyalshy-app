-- Extensions & Functions (required before any table using uuidv7)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION uuidv7() RETURNS uuid AS $$
DECLARE
  unix_ts_ms bytea;
  uuid_bytes bytea;
BEGIN
  unix_ts_ms = substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3);
  uuid_bytes = unix_ts_ms || gen_random_bytes(10);
  uuid_bytes = set_byte(uuid_bytes, 6, (b'0111' || get_byte(uuid_bytes, 6)::bit(4))::bit(8)::int);
  uuid_bytes = set_byte(uuid_bytes, 8, (b'10' || get_byte(uuid_bytes, 8)::bit(6))::bit(8)::int);
  RETURN encode(uuid_bytes, 'hex')::uuid;
END
$$ LANGUAGE plpgsql VOLATILE;

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('user', 'admin_support', 'admin_billing', 'admin_ops', 'super_admin');

-- CreateEnum
CREATE TYPE "admin_action" AS ENUM ('user_banned', 'user_unbanned', 'user_role_changed', 'user_sessions_revoked', 'user_impersonated', 'user_impersonation_ended', 'user_data_exported', 'user_deleted', 'org_plan_changed', 'org_status_changed', 'org_deleted', 'contacts_purged', 'bulk_ban', 'bulk_status_change', 'bulk_export');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('trialing', 'active', 'past_due', 'canceled');

-- CreateEnum
CREATE TYPE "plan" AS ENUM ('free', 'starter', 'growth', 'scale', 'enterprise');

-- CreateEnum
CREATE TYPE "pass_type" AS ENUM ('stamp_card', 'coupon', 'membership', 'points', 'gift_card', 'ticket');

-- CreateEnum
CREATE TYPE "template_status" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "join_mode" AS ENUM ('open', 'invite_only');

-- CreateEnum
CREATE TYPE "pass_instance_status" AS ENUM ('active', 'completed', 'suspended', 'expired', 'revoked', 'voided');

-- CreateEnum
CREATE TYPE "wallet_provider" AS ENUM ('apple', 'google', 'none');

-- CreateEnum
CREATE TYPE "interaction_type" AS ENUM ('stamp', 'coupon_redeem', 'check_in', 'points_earn', 'points_redeem', 'gift_charge', 'gift_refund', 'ticket_scan', 'ticket_void', 'status_change', 'reward_earned', 'reward_redeemed', 'note');

-- CreateEnum
CREATE TYPE "reward_status" AS ENUM ('available', 'redeemed', 'expired');

-- CreateEnum
CREATE TYPE "wallet_pass_action" AS ENUM ('created', 'updated', 'push_sent', 'push_failed');

-- CreateEnum
CREATE TYPE "staff_role" AS ENUM ('owner', 'staff');

-- CreateEnum
CREATE TYPE "pattern_style" AS ENUM ('none', 'dots', 'waves', 'geometric', 'chevron', 'crosshatch', 'diamonds', 'confetti', 'solid_primary', 'solid_secondary', 'stamp_grid');

-- CreateEnum
CREATE TYPE "progress_style" AS ENUM ('numbers', 'circles', 'squares', 'stars', 'stamps', 'percentage', 'remaining');

-- CreateEnum
CREATE TYPE "font_family" AS ENUM ('sans', 'serif', 'rounded', 'mono');

-- CreateEnum
CREATE TYPE "label_format" AS ENUM ('uppercase', 'title_case', 'lowercase');

-- CreateEnum
CREATE TYPE "design_card_type" AS ENUM ('stamp', 'points', 'tier', 'coupon', 'gift_card', 'ticket', 'generic');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'user',
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "activeOrganizationId" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subscriptionStatus" "subscription_status" NOT NULL DEFAULT 'trialing',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "plan" "plan" NOT NULL DEFAULT 'starter',
    "trialEndsAt" TIMESTAMP(3),
    "logoApple" TEXT,
    "logoGoogle" TEXT,
    "brandColor" TEXT,
    "secondaryColor" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "settings" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "email" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pass_template" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "passType" "pass_type" NOT NULL,
    "joinMode" "join_mode" NOT NULL DEFAULT 'open',
    "status" "template_status" NOT NULL DEFAULT 'draft',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "termsAndConditions" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pass_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pass_instance" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "contactId" TEXT NOT NULL,
    "passTemplateId" TEXT NOT NULL,
    "status" "pass_instance_status" NOT NULL DEFAULT 'active',
    "walletProvider" "wallet_provider" NOT NULL DEFAULT 'none',
    "walletPassId" TEXT,
    "walletPassSerialNumber" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pass_instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "organizationId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "memberNumber" INTEGER NOT NULL,
    "totalInteractions" INTEGER NOT NULL DEFAULT 0,
    "lastInteractionAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interaction" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "contactId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "passTemplateId" TEXT NOT NULL,
    "passInstanceId" TEXT,
    "performedById" TEXT,
    "type" "interaction_type" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "contactId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "passTemplateId" TEXT NOT NULL,
    "passInstanceId" TEXT,
    "status" "reward_status" NOT NULL DEFAULT 'available',
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedById" TEXT,
    "description" TEXT,
    "pointsCost" INTEGER,
    "revealedAt" TIMESTAMP(3),

    CONSTRAINT "reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pass_design" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "passTemplateId" TEXT NOT NULL,
    "cardType" "design_card_type" NOT NULL DEFAULT 'stamp',
    "show_strip" BOOLEAN NOT NULL DEFAULT true,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "textColor" TEXT,
    "stripImageUrl" TEXT,
    "stripImageApple" TEXT,
    "stripImageGoogle" TEXT,
    "patternStyle" "pattern_style" NOT NULL DEFAULT 'none',
    "progressStyle" "progress_style" NOT NULL DEFAULT 'numbers',
    "fontFamily" "font_family" NOT NULL DEFAULT 'sans',
    "labelFormat" "label_format" NOT NULL DEFAULT 'uppercase',
    "customProgressLabel" VARCHAR(30),
    "generatedStripApple" TEXT,
    "generatedStripGoogle" TEXT,
    "templateId" VARCHAR(50),
    "palettePreset" TEXT,
    "businessHours" TEXT,
    "mapAddress" TEXT,
    "mapLatitude" DOUBLE PRECISION,
    "mapLongitude" DOUBLE PRECISION,
    "socialLinks" JSONB NOT NULL DEFAULT '{}',
    "customMessage" TEXT,
    "logo_url" TEXT,
    "logo_apple_url" TEXT,
    "logo_google_url" TEXT,
    "designHash" TEXT NOT NULL DEFAULT '',
    "editorConfig" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pass_design_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_pass_log" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "passInstanceId" TEXT,
    "contactId" TEXT,
    "action" "wallet_pass_action" NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_pass_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_invitation" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "staff_role" NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_registration" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "deviceLibraryIdentifier" TEXT NOT NULL,
    "pushToken" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_registration_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "analytics_snapshot" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "organizationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalContacts" INTEGER NOT NULL DEFAULT 0,
    "newContacts" INTEGER NOT NULL DEFAULT 0,
    "totalInteractions" INTEGER NOT NULL DEFAULT 0,
    "rewardsEarned" INTEGER NOT NULL DEFAULT 0,
    "rewardsRedeemed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_endpoint" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "organizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastDeliveryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_endpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_delivery" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "webhookEndpointId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "statusCode" INTEGER,
    "responseBody" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_request_log" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "organizationId" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_request_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "adminId" TEXT NOT NULL,
    "action" "admin_action" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetLabel" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organization_stripeCustomerId_key" ON "organization"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_stripeSubscriptionId_key" ON "organization"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "member_userId_idx" ON "member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "member_organizationId_userId_key" ON "member"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "invitation_organizationId_idx" ON "invitation"("organizationId");

-- CreateIndex
CREATE INDEX "pass_template_organizationId_idx" ON "pass_template"("organizationId");

-- CreateIndex
CREATE INDEX "pass_template_organizationId_status_idx" ON "pass_template"("organizationId", "status");

-- CreateIndex
CREATE INDEX "pass_template_organizationId_passType_idx" ON "pass_template"("organizationId", "passType");

-- CreateIndex
CREATE UNIQUE INDEX "pass_instance_walletPassId_key" ON "pass_instance"("walletPassId");

-- CreateIndex
CREATE UNIQUE INDEX "pass_instance_walletPassSerialNumber_key" ON "pass_instance"("walletPassSerialNumber");

-- CreateIndex
CREATE INDEX "pass_instance_contactId_idx" ON "pass_instance"("contactId");

-- CreateIndex
CREATE INDEX "pass_instance_passTemplateId_idx" ON "pass_instance"("passTemplateId");

-- CreateIndex
CREATE INDEX "pass_instance_walletPassSerialNumber_idx" ON "pass_instance"("walletPassSerialNumber");

-- CreateIndex
CREATE INDEX "pass_instance_status_idx" ON "pass_instance"("status");

-- CreateIndex
CREATE INDEX "pass_instance_passTemplateId_status_idx" ON "pass_instance"("passTemplateId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pass_instance_contactId_passTemplateId_key" ON "pass_instance"("contactId", "passTemplateId");

-- CreateIndex
CREATE INDEX "contact_organizationId_deletedAt_idx" ON "contact"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "contact_organizationId_totalInteractions_idx" ON "contact"("organizationId", "totalInteractions");

-- CreateIndex
CREATE INDEX "contact_email_idx" ON "contact"("email");

-- CreateIndex
CREATE UNIQUE INDEX "contact_organizationId_email_key" ON "contact"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "contact_organizationId_phone_key" ON "contact"("organizationId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "contact_organizationId_memberNumber_key" ON "contact"("organizationId", "memberNumber");

-- CreateIndex
CREATE INDEX "interaction_organizationId_createdAt_idx" ON "interaction"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "interaction_organizationId_type_idx" ON "interaction"("organizationId", "type");

-- CreateIndex
CREATE INDEX "interaction_passInstanceId_idx" ON "interaction"("passInstanceId");

-- CreateIndex
CREATE INDEX "interaction_contactId_createdAt_idx" ON "interaction"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "interaction_passTemplateId_createdAt_idx" ON "interaction"("passTemplateId", "createdAt");

-- CreateIndex
CREATE INDEX "reward_contactId_idx" ON "reward"("contactId");

-- CreateIndex
CREATE INDEX "reward_passInstanceId_idx" ON "reward"("passInstanceId");

-- CreateIndex
CREATE INDEX "reward_status_idx" ON "reward"("status");

-- CreateIndex
CREATE INDEX "reward_organizationId_status_idx" ON "reward"("organizationId", "status");

-- CreateIndex
CREATE INDEX "reward_organizationId_expiresAt_idx" ON "reward"("organizationId", "expiresAt");

-- CreateIndex
CREATE INDEX "reward_organizationId_status_redeemedAt_idx" ON "reward"("organizationId", "status", "redeemedAt");

-- CreateIndex
CREATE INDEX "reward_passTemplateId_status_idx" ON "reward"("passTemplateId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pass_design_passTemplateId_key" ON "pass_design"("passTemplateId");

-- CreateIndex
CREATE INDEX "wallet_pass_log_passInstanceId_idx" ON "wallet_pass_log"("passInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_invitation_token_key" ON "staff_invitation"("token");

-- CreateIndex
CREATE INDEX "staff_invitation_organizationId_idx" ON "staff_invitation"("organizationId");

-- CreateIndex
CREATE INDEX "device_registration_serialNumber_idx" ON "device_registration"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "device_registration_deviceLibraryIdentifier_serialNumber_key" ON "device_registration"("deviceLibraryIdentifier", "serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_event_stripeEventId_key" ON "webhook_event"("stripeEventId");

-- CreateIndex
CREATE INDEX "webhook_event_processedAt_idx" ON "webhook_event"("processedAt");

-- CreateIndex
CREATE INDEX "analytics_snapshot_organizationId_date_idx" ON "analytics_snapshot"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_snapshot_organizationId_date_key" ON "analytics_snapshot"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_keyHash_key" ON "api_key"("keyHash");

-- CreateIndex
CREATE INDEX "api_key_organizationId_idx" ON "api_key"("organizationId");

-- CreateIndex
CREATE INDEX "api_key_keyHash_idx" ON "api_key"("keyHash");

-- CreateIndex
CREATE INDEX "webhook_endpoint_organizationId_idx" ON "webhook_endpoint"("organizationId");

-- CreateIndex
CREATE INDEX "webhook_delivery_webhookEndpointId_createdAt_idx" ON "webhook_delivery"("webhookEndpointId", "createdAt");

-- CreateIndex
CREATE INDEX "api_request_log_organizationId_createdAt_idx" ON "api_request_log"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "api_request_log_apiKeyId_createdAt_idx" ON "api_request_log"("apiKeyId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_log_adminId_createdAt_idx" ON "admin_audit_log"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_log_targetType_targetId_idx" ON "admin_audit_log"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "admin_audit_log_action_createdAt_idx" ON "admin_audit_log"("action", "createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_log_createdAt_idx" ON "admin_audit_log"("createdAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pass_template" ADD CONSTRAINT "pass_template_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pass_instance" ADD CONSTRAINT "pass_instance_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pass_instance" ADD CONSTRAINT "pass_instance_passTemplateId_fkey" FOREIGN KEY ("passTemplateId") REFERENCES "pass_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact" ADD CONSTRAINT "contact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_passTemplateId_fkey" FOREIGN KEY ("passTemplateId") REFERENCES "pass_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_passInstanceId_fkey" FOREIGN KEY ("passInstanceId") REFERENCES "pass_instance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward" ADD CONSTRAINT "reward_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward" ADD CONSTRAINT "reward_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward" ADD CONSTRAINT "reward_passTemplateId_fkey" FOREIGN KEY ("passTemplateId") REFERENCES "pass_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward" ADD CONSTRAINT "reward_passInstanceId_fkey" FOREIGN KEY ("passInstanceId") REFERENCES "pass_instance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward" ADD CONSTRAINT "reward_redeemedById_fkey" FOREIGN KEY ("redeemedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pass_design" ADD CONSTRAINT "pass_design_passTemplateId_fkey" FOREIGN KEY ("passTemplateId") REFERENCES "pass_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_pass_log" ADD CONSTRAINT "wallet_pass_log_passInstanceId_fkey" FOREIGN KEY ("passInstanceId") REFERENCES "pass_instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_invitation" ADD CONSTRAINT "staff_invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_registration" ADD CONSTRAINT "device_registration_serialNumber_fkey" FOREIGN KEY ("serialNumber") REFERENCES "pass_instance"("walletPassSerialNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_snapshot" ADD CONSTRAINT "analytics_snapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_endpoint" ADD CONSTRAINT "webhook_endpoint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_delivery" ADD CONSTRAINT "webhook_delivery_webhookEndpointId_fkey" FOREIGN KEY ("webhookEndpointId") REFERENCES "webhook_endpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_request_log" ADD CONSTRAINT "api_request_log_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
