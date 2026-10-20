import { loadIssueActivity } from "@/app/issues/activity-actions";
import { ActivityList } from "@/components/issues/ActivityList";
export async function IssueActivityTimeline({ issueId }: { issueId: string }) {
  const initial = await loadIssueActivity(issueId);
  return initial.activities.length ? <ActivityList key={initial.activities[0].id} issueId={issueId} initial={initial} /> : <p className="text-sm text-muted-foreground">No activity recorded yet.</p>;
}
