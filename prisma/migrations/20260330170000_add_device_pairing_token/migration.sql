-- CreateTable
CREATE TABLE "device_pairing_token" (
    "id" TEXT NOT NULL DEFAULT uuidv7()::text,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_pairing_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_pairing_token_token_key" ON "device_pairing_token"("token");

-- CreateIndex
CREATE INDEX "device_pairing_token_organizationId_idx" ON "device_pairing_token"("organizationId");

-- AddForeignKey
ALTER TABLE "device_pairing_token" ADD CONSTRAINT "device_pairing_token_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_pairing_token" ADD CONSTRAINT "device_pairing_token_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
