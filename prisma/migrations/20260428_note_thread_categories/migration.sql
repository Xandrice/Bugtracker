-- Add optional category/folder for team note threads
ALTER TABLE "Note"
ADD COLUMN "category" TEXT;

-- Backfill existing top-level forum threads
UPDATE "Note"
SET "category" = 'GENERAL'
WHERE "issueId" IS NULL
  AND "isThread" = true
  AND "parentId" IS NULL
  AND "category" IS NULL;

CREATE INDEX "Note_category_idx" ON "Note"("category");
