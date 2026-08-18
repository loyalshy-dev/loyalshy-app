-- Partner-led onboarding: handoff tokens let a partner rep transfer org
-- ownership to the real owner via a one-shot claim link. Hand-written
-- (shadow-DB validation still trips on post_pivot_drift); applied via
-- `prisma migrate deploy`.

-- AlterEnum
ALTER TYPE "org_audit_action" ADD VALUE 'handoff_link_created';
ALTER TYPE "org_audit_action" ADD VALUE 'ownership_claimed';

-- CreateTable
CREATE TABLE "org_handoff_token" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "claimedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_handoff_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_handoff_token_token_key" ON "org_handoff_token"("token");

-- CreateIndex
CREATE INDEX "org_handoff_token_organizationId_idx" ON "org_handoff_token"("organizationId");

-- AddForeignKey
ALTER TABLE "org_handoff_token" ADD CONSTRAINT "org_handoff_token_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_handoff_token" ADD CONSTRAINT "org_handoff_token_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
