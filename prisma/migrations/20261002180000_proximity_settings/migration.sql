-- "Near your business" moves from each program's design studio to an
-- org-level setting under Automations (one location per business).

-- CreateTable
CREATE TABLE "proximity_settings" (
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "message" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proximity_settings_pkey" PRIMARY KEY ("organizationId")
);

-- AddForeignKey
ALTER TABLE "proximity_settings" ADD CONSTRAINT "proximity_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Carry over what orgs already configured in the studio: per org, the
-- location of its most relevant program (active first, then most recently
-- edited), with that program's custom lock-screen message if it had one.
INSERT INTO "proximity_settings" ("organizationId", "enabled", "address", "latitude", "longitude", "message", "updatedAt")
SELECT DISTINCT ON (pt."organizationId")
  pt."organizationId",
  true,
  COALESCE(NULLIF(pd."mapAddress", ''), ''),
  pd."mapLatitude",
  pd."mapLongitude",
  NULLIF(BTRIM(pd."editorConfig"->>'locationMessage'), ''),
  CURRENT_TIMESTAMP
FROM "pass_design" pd
JOIN "pass_template" pt ON pt.id = pd."passTemplateId"
WHERE pd."mapLatitude" IS NOT NULL AND pd."mapLongitude" IS NOT NULL
ORDER BY pt."organizationId", (pt.status = 'active') DESC, pd."updatedAt" DESC;
