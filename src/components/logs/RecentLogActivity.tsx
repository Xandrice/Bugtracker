"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { describeLogEvent, type LogEntry } from "@/lib/log-events";
import { formatRelativeTime } from "@/lib/time";
const subscribe = () => () => {};
export function RecentLogActivity({ entries, identifier }: { entries: LogEntry[]; identifier: string }) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return <div className="space-y-2">{entries.length ? entries.map((entry,index) => { const event = describeLogEvent(entry); return <div key={index} className="border-b border-border py-2 text-sm"><span style={{ color: event.color }}>{event.icon}</span> {event.summary}<time className="mt-1 block text-xs text-muted-foreground" dateTime={entry._time} title={hydrated ? new Date(entry._time).toLocaleString() : entry._time}>{hydrated ? formatRelativeTime(entry._time) : entry._time}</time></div>; }) : <p className="text-xs text-muted-foreground">No recent activity in the last 24 hours.</p>}<Link className="text-xs text-primary underline" href={`/staff-tools/players/${encodeURIComponent(identifier)}?tab=logs&range=24h`}>View player logs</Link></div>;
}
