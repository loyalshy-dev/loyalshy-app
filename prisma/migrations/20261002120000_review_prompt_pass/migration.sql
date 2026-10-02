-- The pass a contact's Google review prompt was delivered through. Only that
-- pass carries the notifying version of the review field; before this, every
-- pass of a recently-asked contact did, so adding a second pass re-bannered
-- the same ask.

-- AlterTable
ALTER TABLE "contact" ADD COLUMN "reviewPromptPassId" TEXT;
