-- Partner access-request audit event (rep asks a referred client's owner
-- for Program manager access). Hand-written; applied via migrate deploy.

-- AlterEnum
ALTER TYPE "org_audit_action" ADD VALUE 'access_requested';
