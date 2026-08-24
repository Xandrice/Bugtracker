-- Manual Jira-style backlog order. String lexorank so a drop updates one row
-- instead of rewriting the whole list. Apply outside the Vercel build:
--   pnpm prisma migrate deploy
-- or, if you are not using migration history:
--   pnpm prisma db push

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN "backlogRank" TEXT;

-- CreateIndex
CREATE INDEX "Issue_status_backlogRank_idx" ON "Issue"("status", "backlogRank");

-- Backfill existing BACKLOG issues in the order the page currently shows
-- (updatedAt DESC) so the first displayed row gets the earliest rank.
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "updatedAt" DESC, id ASC) AS rn
  FROM "Issue"
  WHERE status = 'BACKLOG'
)
UPDATE "Issue" AS i
SET "backlogRank" = lpad(to_hex(o.rn * 1024), 8, '0')
FROM ordered AS o
WHERE i.id = o.id;
