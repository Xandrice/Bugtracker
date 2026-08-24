import { db } from "@/lib/db";
import { DEFAULT_ISSUE_TEMPLATES } from "@/lib/issue-templates";

/** One-shot seed. Safe to call on read paths; never overwrites staff edits. */
export async function ensureDefaultIssueTemplates() {
  await db.issueTemplate.createMany({
    data: DEFAULT_ISSUE_TEMPLATES,
    skipDuplicates: true,
  });
}
