-- Add forum-style threading support for team notes
ALTER TABLE "Note"
ADD COLUMN "isThread" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "parentId" TEXT;

ALTER TABLE "Note"
ADD CONSTRAINT "Note_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "Note"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Note_parentId_idx" ON "Note"("parentId");
CREATE INDEX "Note_isThread_issueId_idx" ON "Note"("isThread", "issueId");
