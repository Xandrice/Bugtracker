ALTER TABLE "Issue" ADD COLUMN "discordSyncedAt" TIMESTAMP(3);
ALTER TABLE "Note" ADD COLUMN "internal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Note" ADD COLUMN "discordSyncStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Note" ADD COLUMN "discordDelivery" JSONB;
CREATE INDEX "Note_issueId_internal_createdAt_idx" ON "Note"("issueId", "internal", "createdAt");
