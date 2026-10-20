"use client";
import { useState, useSyncExternalStore } from "react";
import { loadIssueActivity } from "@/app/issues/activity-actions";
import { activityFieldLabel, activityValueLabel, formatActivityLabel } from "@/lib/activity-labels";
import { formatRelativeTime } from "@/lib/time";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
const subscribe = () => () => {};
type Page = Awaited<ReturnType<typeof loadIssueActivity>>;
export function ActivityList({ issueId, initial }: { issueId: string; initial: Page }) {
  const [page, setPage] = useState(initial); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return <div className="space-y-2">{page.activities.map(activity => <div key={activity.id} className="flex items-start gap-3 rounded border border-border bg-surface px-3 py-2.5"><Avatar src={activity.actor.image} name={activity.actor.name} size="sm" /><div className="min-w-0 space-y-1"><p className="text-sm"><strong>{activity.actor.name || "Someone"}</strong> <span className="text-muted-foreground">{activity.action === "FIELD_CHANGE" ? `Changed ${activityFieldLabel(activity.field).toLowerCase()}` : formatActivityLabel(activity)}</span></p>{activity.action === "FIELD_CHANGE" && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">View change</summary><p className="mt-1 whitespace-pre-wrap break-words">Before: {activityValueLabel(activity.oldValue, activity.field)}</p><p className="whitespace-pre-wrap break-words">After: {activityValueLabel(activity.newValue, activity.field)}</p></details>}<time dateTime={activity.createdAt} title={hydrated ? new Date(activity.createdAt).toLocaleString() : activity.createdAt} className="text-[11px] text-muted-foreground">{hydrated ? `${new Date(activity.createdAt).toLocaleString()} · ${formatRelativeTime(activity.createdAt)}` : activity.createdAt.slice(0, 16).replace("T", " ") + " UTC"}</time></div></div>)}{error && <p role="alert" className="text-xs text-danger">{error}</p>}{page.more && <Button disabled={loading} onClick={async () => { setLoading(true); setError(""); try { const next = await loadIssueActivity(issueId, page.activities.at(-1)?.id); setPage(previous => ({ activities: [...previous.activities, ...next.activities], more: next.more })); } catch { setError("Could not load older history. Please retry."); } finally { setLoading(false); } }}>{loading ? "Loading…" : "Load more history"}</Button>}</div>;
}
