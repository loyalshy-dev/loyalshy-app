-- Org-level audit log: visible to org owners, scoped to one organization.
-- Mirrors AdminAuditLog but for owner-actioned events (invite send/cancel/
-- accept, member remove/role change). actorUserId is nullable + ON DELETE
-- SET NULL so the trail survives if the actor's User row is later deleted;
-- actorEmail is denormalized for the same reason.

-- CreateEnum
CREATE TYPE "org_audit_action" AS ENUM (
  'invitation_sent',
  'invitation_resent',
  'invitation_cancelled',
  'invitation_accepted',
  'member_removed',
  'member_role_changed'
);

-- CreateTable
CREATE TABLE "org_audit_log" (
  "id" TEXT NOT NULL DEFAULT uuidv7()::text,
  "organizationId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorEmail" TEXT,
  "action" "org_audit_action" NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "targetLabel" TEXT,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "org_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_audit_log_organizationId_createdAt_idx" ON "org_audit_log"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "org_audit_log_action_idx" ON "org_audit_log"("action");

-- AddForeignKey
ALTER TABLE "org_audit_log" ADD CONSTRAINT "org_audit_log_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_audit_log" ADD CONSTRAINT "org_audit_log_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
