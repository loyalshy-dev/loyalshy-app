-- DevicePairingToken: add pin_hash + failed_attempts for QR pairing 2FA.
--
-- Existing pairing tokens (5-min TTL) are effectively dead by the time this
-- migration runs in any non-prod environment, so the placeholder pin_hash
-- value is fine. Production has no in-flight pairing rows in practice.

ALTER TABLE "device_pairing_token"
  ADD COLUMN "pin_hash" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "failed_attempts" INTEGER NOT NULL DEFAULT 0;

-- Drop the default — application code must always supply a hash going forward.
ALTER TABLE "device_pairing_token" ALTER COLUMN "pin_hash" DROP DEFAULT;
