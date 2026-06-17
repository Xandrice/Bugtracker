-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN "discordDisplayName" TEXT;
ALTER TABLE "ProjectMember" ADD COLUMN "discordAvatar" TEXT;
ALTER TABLE "ProjectMember" ADD COLUMN "profileSyncedAt" TIMESTAMP(3);
