CREATE INDEX "Issue_parentIssueId_updatedAt_id_idx" ON "Issue"("parentIssueId", "updatedAt", "id");
CREATE INDEX "Issue_assigneeId_status_updatedAt_id_idx" ON "Issue"("assigneeId", "status", "updatedAt", "id");
CREATE INDEX "Issue_status_updatedAt_id_idx" ON "Issue"("status", "updatedAt", "id");
