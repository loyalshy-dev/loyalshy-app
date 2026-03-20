-- AlterEnum: add new admin roles to user_role
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'admin_support';
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'admin_billing';
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'admin_ops';

-- CreateEnum: admin_action
CREATE TYPE "admin_action" AS ENUM (
  'user_banned',
  'user_unbanned',
  'user_role_changed',
  'user_sessions_revoked',
  'user_impersonated',
  'user_impersonation_ended',
  'user_data_exported',
  'user_deleted',
  'org_plan_changed',
  'org_status_changed',
  'org_deleted',
  'contacts_purged',
  'bulk_ban',
  'bulk_status_change',
  'bulk_export'
);

-- CreateTable: admin_audit_log
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
CREATE INDEX "admin_audit_log_adminId_createdAt_idx" ON "admin_audit_log"("adminId", "createdAt");
CREATE INDEX "admin_audit_log_targetType_targetId_idx" ON "admin_audit_log"("targetType", "targetId");
CREATE INDEX "admin_audit_log_action_createdAt_idx" ON "admin_audit_log"("action", "createdAt");
CREATE INDEX "admin_audit_log_createdAt_idx" ON "admin_audit_log"("createdAt");

-- AddForeignKey
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
