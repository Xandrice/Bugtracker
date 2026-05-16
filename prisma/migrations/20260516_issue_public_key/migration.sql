-- Add new short, random public key column and drop the legacy sequential issueNumber.

ALTER TABLE "Issue" ADD COLUMN "publicKey" TEXT;

-- Backfill existing rows with an 8-char lowercase alphanumeric key derived from the cuid.
-- substring(md5(...)) keeps things deterministic per row so retries are idempotent.
UPDATE "Issue"
SET "publicKey" = substring(md5("id" || random()::text), 1, 8)
WHERE "publicKey" IS NULL;

CREATE UNIQUE INDEX "Issue_publicKey_key" ON "Issue"("publicKey");

DROP INDEX IF EXISTS "Issue_issueNumber_key";
ALTER TABLE "Issue" DROP COLUMN IF EXISTS "issueNumber";
