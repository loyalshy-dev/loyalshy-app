-- Partner referral attribution: User.referralCode powers /register?ref=
-- links; Organization.referredById is the canonical attribution column for
-- the rev-share statement (set by partner org creation and by referred
-- self-signups). Hand-written (shadow-DB validation still trips on
-- post_pivot_drift); applied via `prisma migrate deploy`.

-- AlterTable
ALTER TABLE "user" ADD COLUMN "referralCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_referralCode_key" ON "user"("referralCode");

-- AlterTable
ALTER TABLE "organization" ADD COLUMN "referredById" TEXT;

-- CreateIndex
CREATE INDEX "organization_referredById_idx" ON "organization"("referredById");

-- AddForeignKey
ALTER TABLE "organization" ADD CONSTRAINT "organization_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: partner-created orgs from the handoff flow stamped
-- settings.createdByPartner before this column existed.
UPDATE "organization"
SET "referredById" = "settings"->>'createdByPartner'
WHERE "referredById" IS NULL
  AND "settings"->>'createdByPartner' IS NOT NULL
  AND EXISTS (SELECT 1 FROM "user" u WHERE u."id" = "settings"->>'createdByPartner');
