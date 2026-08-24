/**
 * Reporter and assignee are *implicit* watchers: they already receive
 * STATUS_CHANGE in-app + Discord DM notifications without a row here.
 * Watch / Unwatch only writes `IssueWatcher`. Explicit watchers are added to
 * the same `notifyUser` path for STATUS_CHANGE and COMMENT (comments already
 * notify the assignee). Unwatch does not stop reporter/assignee status pings
 * while those roles still apply.
 */
export function uniqueUserIds(
  ...values: Array<string | null | undefined | readonly string[]>
): string[] {
  const ids = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    if (typeof value === "string") {
      ids.add(value);
      continue;
    }
    for (const id of value) {
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

export async function getIssueWatcherUserIds(issueId: string): Promise<string[]> {
  const { db } = await import("./db");
  const rows = await db.issueWatcher.findMany({
    where: { issueId },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}
