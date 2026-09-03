-- Explicit issue watchers (Jira/GitHub-style). Apply outside the Vercel build:
--   pnpm prisma migrate deploy
-- or, if you are not using migration history:
--   pnpm prisma db push

CREATE TABLE IF NOT EXISTS "IssueWatcher" (
  "id"        TEXT NOT NULL,
  "issueId"   TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IssueWatcher_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IssueWatcher_issueId_userId_key"
  ON "IssueWatcher"("issueId", "userId");
CREATE INDEX IF NOT EXISTS "IssueWatcher_userId_idx" ON "IssueWatcher"("userId");
CREATE INDEX IF NOT EXISTS "IssueWatcher_issueId_idx" ON "IssueWatcher"("issueId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IssueWatcher_issueId_fkey'
  ) THEN
    ALTER TABLE "IssueWatcher"
      ADD CONSTRAINT "IssueWatcher_issueId_fkey"
      FOREIGN KEY ("issueId") REFERENCES "Issue"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IssueWatcher_userId_fkey'
  ) THEN
    ALTER TABLE "IssueWatcher"
      ADD CONSTRAINT "IssueWatcher_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
