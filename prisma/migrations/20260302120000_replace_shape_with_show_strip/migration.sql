-- AlterTable: Replace shape enum with showStrip boolean
ALTER TABLE "card_design" ADD COLUMN "show_strip" BOOLEAN NOT NULL DEFAULT true;

-- Migrate data: CLEAN shape -> showStrip false, others -> true (already default)
UPDATE "card_design" SET "show_strip" = false WHERE "shape" = 'clean';

-- Drop old column and enum
ALTER TABLE "card_design" DROP COLUMN "shape";
DROP TYPE IF EXISTS "card_shape";
