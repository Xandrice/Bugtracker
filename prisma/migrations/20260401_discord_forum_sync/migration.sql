-- Add Discord linkage fields to issues for forum thread/channel sync
ALTER TABLE "Issue"
ADD COLUMN "discordChannelId" TEXT,
ADD COLUMN "discordThreadId" TEXT,
ADD COLUMN "discordMessageId" TEXT;

CREATE UNIQUE INDEX "Issue_discordThreadId_key" ON "Issue"("discordThreadId");

-- Add Discord source metadata to notes for inbound comment sync and dedupe
ALTER TABLE "Note"
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'APP',
ADD COLUMN "discordMessageId" TEXT,
ADD COLUMN "discordAuthorId" TEXT,
ADD COLUMN "discordAuthorTag" TEXT;

CREATE UNIQUE INDEX "Note_discordMessageId_key" ON "Note"("discordMessageId");
