CREATE TABLE "IssueAssignee" (
    "issueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "IssueAssignee_pkey" PRIMARY KEY ("issueId", "userId"),
    CONSTRAINT "IssueAssignee_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IssueAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "IssueAssignee_userId_issueId_idx" ON "IssueAssignee"("userId", "issueId");

-- Preserve existing assignments. Keep the legacy column for older integrations.
INSERT INTO "IssueAssignee" ("issueId", "userId")
SELECT "id", "assigneeId" FROM "Issue" WHERE "assigneeId" IS NOT NULL;
