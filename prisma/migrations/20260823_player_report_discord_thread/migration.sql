-- Discord thread id for player-report intake idempotency.
ALTER TABLE "PlayerReport"
ADD COLUMN IF NOT EXISTS "discordThreadId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "PlayerReport_discordThreadId_key"
  ON "PlayerReport"("discordThreadId");
