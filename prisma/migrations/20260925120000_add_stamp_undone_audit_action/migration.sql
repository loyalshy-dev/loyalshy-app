-- Staff app "undo last stamp" audit event. Hand-written (the post_pivot_drift
-- migration trips shadow-DB validation); applied via migrate deploy.

-- AlterEnum
ALTER TYPE "org_audit_action" ADD VALUE 'stamp_undone';
