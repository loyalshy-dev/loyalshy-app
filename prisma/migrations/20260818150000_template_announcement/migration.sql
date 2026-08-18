-- Per-template broadcast announcement ({ message, sentAt, history }) shown on
-- wallet passes and pushed as a lock-screen notification to all holders.
ALTER TABLE "pass_template" ADD COLUMN "announcement" JSONB;
