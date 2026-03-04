-- Rename plan enum values: pro → growth, business → scale
ALTER TYPE "plan" RENAME VALUE 'pro' TO 'growth';
ALTER TYPE "plan" RENAME VALUE 'business' TO 'scale';
