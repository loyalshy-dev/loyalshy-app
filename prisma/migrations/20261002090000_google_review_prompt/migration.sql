-- Google review prompt: per-contact prompt/click state, per-org settings,
-- and daily Google rating snapshots (Places API).

-- AlterTable
ALTER TABLE "contact" ADD COLUMN "reviewPromptedAt" TIMESTAMP(3),
ADD COLUMN "reviewLinkOpenedAt" TIMESTAMP(3),
ADD COLUMN "reviewLinkOpens" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "contact_organizationId_reviewPromptedAt_idx" ON "contact"("organizationId", "reviewPromptedAt");

-- CreateTable
CREATE TABLE "google_review_settings" (
  "organizationId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "placeId" TEXT,
  "placeName" TEXT,
  "reviewUrl" TEXT NOT NULL,
  "triggerStamp" INTEGER NOT NULL DEFAULT 3,
  "message" TEXT NOT NULL,
  "linkLabel" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "google_review_settings_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "google_rating_snapshot" (
  "id" TEXT NOT NULL DEFAULT uuidv7()::text,
  "organizationId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "rating" DOUBLE PRECISION,
  "ratingCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "google_rating_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_rating_snapshot_organizationId_date_key" ON "google_rating_snapshot"("organizationId", "date");

-- AddForeignKey
ALTER TABLE "google_review_settings" ADD CONSTRAINT "google_review_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "google_rating_snapshot" ADD CONSTRAINT "google_rating_snapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
