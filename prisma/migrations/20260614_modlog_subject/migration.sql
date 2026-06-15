-- Mod-log entries can be tied to the Discord identity they are about.
ALTER TABLE "PlayerReport"
ADD COLUMN IF NOT EXISTS "subjectDiscordId" TEXT,
ADD COLUMN IF NOT EXISTS "subjectName" TEXT;

CREATE INDEX IF NOT EXISTS "PlayerReport_subjectDiscordId_idx"
  ON "PlayerReport"("subjectDiscordId");
