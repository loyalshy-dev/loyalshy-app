-- Performance indexes for dashboard query optimization

-- Interaction: covers template-scoped analytics and stats queries
CREATE INDEX "interaction_passTemplateId_createdAt_idx" ON "interaction"("passTemplateId", "createdAt");

-- Reward: covers overview stats with date-range filters (redeemedAt)
CREATE INDEX "reward_organizationId_status_redeemedAt_idx" ON "reward"("organizationId", "status", "redeemedAt");

-- Reward: covers per-template reward counts and summaries
CREATE INDEX "reward_passTemplateId_status_idx" ON "reward"("passTemplateId", "status");

-- Contact: GIN trigram index for fast case-insensitive fullName search (ILIKE '%query%')
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "contact_fullName_trgm_idx" ON "contact" USING GIN (lower("fullName") gin_trgm_ops);
