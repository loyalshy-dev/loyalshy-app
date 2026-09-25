-- Per-send announcement log. Announcement quotas are now per organization and
-- tied to the plan (Free: 2 lifetime, Pro 1/wk, Business 2/wk, Scale 5/wk,
-- Enterprise unlimited — rolling 7 days), which needs history beyond the
-- 24h-trimmed PassTemplate.announcement.history JSON.

-- CreateTable
CREATE TABLE "program_announcement" (
  "id" TEXT NOT NULL DEFAULT uuidv7()::text,
  "organizationId" TEXT NOT NULL,
  "passTemplateId" TEXT,
  "sentById" TEXT,
  "message" TEXT NOT NULL,
  "recipients" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "program_announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "program_announcement_organizationId_createdAt_idx" ON "program_announcement"("organizationId", "createdAt" DESC);
CREATE INDEX "program_announcement_passTemplateId_createdAt_idx" ON "program_announcement"("passTemplateId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "program_announcement" ADD CONSTRAINT "program_announcement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "program_announcement" ADD CONSTRAINT "program_announcement_passTemplateId_fkey" FOREIGN KEY ("passTemplateId") REFERENCES "pass_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "program_announcement" ADD CONSTRAINT "program_announcement_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every send still recorded in PassTemplate.announcement.history
-- counts toward the new quota (history is capped at 10 entries). Templates
-- with an announcement but no history get one row for sentAt.
INSERT INTO "program_announcement" ("organizationId", "passTemplateId", "message", "createdAt")
SELECT t."organizationId", t."id", t."announcement"->>'message', ((h.ts)::timestamptz AT TIME ZONE 'UTC')
FROM "pass_template" t
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE
    WHEN jsonb_typeof(t."announcement"->'history') = 'array' AND jsonb_array_length(t."announcement"->'history') > 0
      THEN t."announcement"->'history'
    ELSE jsonb_build_array(t."announcement"->>'sentAt')
  END
) AS h(ts)
WHERE t."announcement" IS NOT NULL
  AND t."announcement"->>'message' IS NOT NULL
  AND h.ts IS NOT NULL;
