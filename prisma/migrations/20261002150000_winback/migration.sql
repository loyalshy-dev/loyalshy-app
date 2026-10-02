-- Win-back ("we miss you") messages: per-org settings and one row per contact
-- per absence (src/lib/winback).

-- CreateTable
CREATE TABLE "winback_settings" (
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "inactiveDays" INTEGER NOT NULL DEFAULT 30,
    "message" TEXT NOT NULL,
    "holdout" BOOLEAN NOT NULL DEFAULT true,
    "includeExisting" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "winback_settings_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "winback_send" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "passInstanceId" TEXT,
    "lapseKey" TIMESTAMP(3) NOT NULL,
    "control" BOOLEAN NOT NULL DEFAULT false,
    "reachable" BOOLEAN NOT NULL DEFAULT true,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "winback_send_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "winback_send_organizationId_sentAt_idx" ON "winback_send"("organizationId", "sentAt");

-- CreateIndex
CREATE INDEX "winback_send_passInstanceId_sentAt_idx" ON "winback_send"("passInstanceId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "winback_send_contactId_lapseKey_key" ON "winback_send"("contactId", "lapseKey");

-- AddForeignKey
ALTER TABLE "winback_settings" ADD CONSTRAINT "winback_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "winback_send" ADD CONSTRAINT "winback_send_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "winback_send" ADD CONSTRAINT "winback_send_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "winback_send" ADD CONSTRAINT "winback_send_passInstanceId_fkey" FOREIGN KEY ("passInstanceId") REFERENCES "pass_instance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

