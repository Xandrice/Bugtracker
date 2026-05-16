-- Subtasks: parent/child issue relationship
ALTER TABLE "Issue"
ADD COLUMN "parentIssueId" TEXT;

ALTER TABLE "Issue"
ADD CONSTRAINT "Issue_parentIssueId_fkey" FOREIGN KEY ("parentIssueId")
  REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Issue_parentIssueId_idx" ON "Issue"("parentIssueId");

-- Issue links (blocks / blocked by / relates to / duplicates)
CREATE TABLE "IssueLink" (
  "id"        TEXT NOT NULL,
  "type"      TEXT NOT NULL,
  "sourceId"  TEXT NOT NULL,
  "targetId"  TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IssueLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IssueLink_sourceId_targetId_type_key"
  ON "IssueLink"("sourceId", "targetId", "type");
CREATE INDEX "IssueLink_sourceId_idx" ON "IssueLink"("sourceId");
CREATE INDEX "IssueLink_targetId_idx" ON "IssueLink"("targetId");

ALTER TABLE "IssueLink"
ADD CONSTRAINT "IssueLink_sourceId_fkey" FOREIGN KEY ("sourceId")
  REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IssueLink"
ADD CONSTRAINT "IssueLink_targetId_fkey" FOREIGN KEY ("targetId")
  REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Notifications (in-app inbox)
CREATE TABLE "Notification" (
  "id"        TEXT NOT NULL,
  "type"      TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "body"      TEXT,
  "link"      TEXT,
  "readAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId"    TEXT NOT NULL,
  "actorId"   TEXT,
  "issueId"   TEXT,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_readAt_idx"    ON "Notification"("userId", "readAt");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId")
  REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
