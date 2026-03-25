-- CreateTable
CREATE TABLE "platform_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "disabledPassTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_config_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row with BUSINESS_CARD disabled by default
INSERT INTO "platform_config" ("id", "disabledPassTypes", "updatedAt")
VALUES ('singleton', ARRAY['BUSINESS_CARD'], NOW())
ON CONFLICT ("id") DO NOTHING;
