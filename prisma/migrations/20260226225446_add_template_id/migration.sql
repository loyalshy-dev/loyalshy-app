-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('user', 'super_admin');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'free');

-- CreateEnum
CREATE TYPE "plan" AS ENUM ('free', 'starter', 'pro', 'enterprise');

-- CreateEnum
CREATE TYPE "wallet_pass_type" AS ENUM ('apple', 'google', 'none');

-- CreateEnum
CREATE TYPE "reward_status" AS ENUM ('available', 'redeemed', 'expired');

-- CreateEnum
CREATE TYPE "wallet_pass_action" AS ENUM ('created', 'updated', 'push_sent', 'push_failed');

-- CreateEnum
CREATE TYPE "staff_role" AS ENUM ('owner', 'staff');

-- CreateEnum
CREATE TYPE "card_shape" AS ENUM ('clean', 'showcase', 'info_rich');

-- CreateEnum
CREATE TYPE "pattern_style" AS ENUM ('none', 'dots', 'waves', 'geometric');

-- CreateEnum
CREATE TYPE "progress_style" AS ENUM ('numbers', 'circles', 'squares', 'stars', 'stamps', 'percentage', 'remaining');

-- CreateEnum
CREATE TYPE "font_family" AS ENUM ('sans', 'serif', 'rounded', 'mono');

-- CreateEnum
CREATE TYPE "label_format" AS ENUM ('uppercase', 'title_case', 'lowercase');

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
    "restaurantId" TEXT,
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
CREATE TABLE "organization" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
CREATE TABLE "restaurant" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "brandColor" TEXT,
    "secondaryColor" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "subscriptionStatus" "subscription_status" NOT NULL DEFAULT 'free',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "plan" "plan" NOT NULL DEFAULT 'free',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_program" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visitsRequired" INTEGER NOT NULL DEFAULT 10,
    "rewardDescription" TEXT NOT NULL,
    "rewardExpiryDays" INTEGER NOT NULL DEFAULT 90,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "termsAndConditions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "restaurantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "walletPassId" TEXT,
    "walletPassSerialNumber" TEXT,
    "walletPassType" "wallet_pass_type" NOT NULL DEFAULT 'none',
    "currentCycleVisits" INTEGER NOT NULL DEFAULT 0,
    "totalVisits" INTEGER NOT NULL DEFAULT 0,
    "totalRewardsRedeemed" INTEGER NOT NULL DEFAULT 0,
    "lastVisitAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "customerId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "loyaltyProgramId" TEXT NOT NULL,
    "registeredById" TEXT,
    "visitNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "customerId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "loyaltyProgramId" TEXT NOT NULL,
    "status" "reward_status" NOT NULL DEFAULT 'available',
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedById" TEXT,

    CONSTRAINT "reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_pass_log" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "customerId" TEXT NOT NULL,
    "action" "wallet_pass_action" NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_pass_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_invitation" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "restaurantId" TEXT NOT NULL,
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
CREATE TABLE "analytics_snapshot" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "restaurantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalCustomers" INTEGER NOT NULL DEFAULT 0,
    "newCustomers" INTEGER NOT NULL DEFAULT 0,
    "totalVisits" INTEGER NOT NULL DEFAULT 0,
    "rewardsEarned" INTEGER NOT NULL DEFAULT 0,
    "rewardsRedeemed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_design" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "restaurantId" TEXT NOT NULL,
    "shape" "card_shape" NOT NULL DEFAULT 'clean',
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
    "socialLinks" JSONB NOT NULL DEFAULT '{}',
    "customMessage" TEXT,
    "designHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_design_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_restaurantId_idx" ON "user"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "member_userId_idx" ON "member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "member_organizationId_userId_key" ON "member"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "invitation_organizationId_idx" ON "invitation"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_slug_key" ON "restaurant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_stripeCustomerId_key" ON "restaurant"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_stripeSubscriptionId_key" ON "restaurant"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "loyalty_program_restaurantId_idx" ON "loyalty_program"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_walletPassId_key" ON "customer"("walletPassId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_walletPassSerialNumber_key" ON "customer"("walletPassSerialNumber");

-- CreateIndex
CREATE INDEX "customer_restaurantId_deletedAt_idx" ON "customer"("restaurantId", "deletedAt");

-- CreateIndex
CREATE INDEX "customer_restaurantId_totalVisits_idx" ON "customer"("restaurantId", "totalVisits");

-- CreateIndex
CREATE INDEX "customer_walletPassSerialNumber_idx" ON "customer"("walletPassSerialNumber");

-- CreateIndex
CREATE INDEX "customer_email_idx" ON "customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customer_restaurantId_email_key" ON "customer"("restaurantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "customer_restaurantId_phone_key" ON "customer"("restaurantId", "phone");

-- CreateIndex
CREATE INDEX "visit_customerId_idx" ON "visit"("customerId");

-- CreateIndex
CREATE INDEX "visit_restaurantId_idx" ON "visit"("restaurantId");

-- CreateIndex
CREATE INDEX "visit_createdAt_idx" ON "visit"("createdAt");

-- CreateIndex
CREATE INDEX "visit_restaurantId_createdAt_idx" ON "visit"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "visit_customerId_createdAt_idx" ON "visit"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "reward_customerId_idx" ON "reward"("customerId");

-- CreateIndex
CREATE INDEX "reward_status_idx" ON "reward"("status");

-- CreateIndex
CREATE INDEX "reward_restaurantId_status_idx" ON "reward"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "reward_restaurantId_expiresAt_idx" ON "reward"("restaurantId", "expiresAt");

-- CreateIndex
CREATE INDEX "wallet_pass_log_customerId_idx" ON "wallet_pass_log"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_invitation_token_key" ON "staff_invitation"("token");

-- CreateIndex
CREATE INDEX "staff_invitation_restaurantId_idx" ON "staff_invitation"("restaurantId");

-- CreateIndex
CREATE INDEX "device_registration_serialNumber_idx" ON "device_registration"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "device_registration_deviceLibraryIdentifier_serialNumber_key" ON "device_registration"("deviceLibraryIdentifier", "serialNumber");

-- CreateIndex
CREATE INDEX "analytics_snapshot_restaurantId_date_idx" ON "analytics_snapshot"("restaurantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_snapshot_restaurantId_date_key" ON "analytics_snapshot"("restaurantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "card_design_restaurantId_key" ON "card_design"("restaurantId");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_program" ADD CONSTRAINT "loyalty_program_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit" ADD CONSTRAINT "visit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit" ADD CONSTRAINT "visit_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit" ADD CONSTRAINT "visit_loyaltyProgramId_fkey" FOREIGN KEY ("loyaltyProgramId") REFERENCES "loyalty_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit" ADD CONSTRAINT "visit_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward" ADD CONSTRAINT "reward_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward" ADD CONSTRAINT "reward_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward" ADD CONSTRAINT "reward_loyaltyProgramId_fkey" FOREIGN KEY ("loyaltyProgramId") REFERENCES "loyalty_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward" ADD CONSTRAINT "reward_redeemedById_fkey" FOREIGN KEY ("redeemedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_pass_log" ADD CONSTRAINT "wallet_pass_log_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_invitation" ADD CONSTRAINT "staff_invitation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_registration" ADD CONSTRAINT "device_registration_serialNumber_fkey" FOREIGN KEY ("serialNumber") REFERENCES "customer"("walletPassSerialNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_snapshot" ADD CONSTRAINT "analytics_snapshot_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_design" ADD CONSTRAINT "card_design_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
