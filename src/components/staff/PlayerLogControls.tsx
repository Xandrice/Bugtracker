"use client";

import { useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { LOG_RANGES, localLogDateInput, localLogDateToUtc, readLogParam, resolvePlayerLogRange, type PlayerLogParams } from "@/lib/player-logs";

const subscribe = () => () => {};
const selectClass = "h-9 w-full rounded-md border border-input bg-elevated px-3 text-sm text-foreground focus-ring";

export function PlayerLogControls({ params }: { params: PlayerLogParams }) {
  const router = useRouter();
  const pathname = usePathname();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [range, setRange] = useState(readLogParam(params.range) || "1h");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const timezone = mounted ? Intl.DateTimeFormat().resolvedOptions().timeZone : "your local timezone";

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next: Record<string, string> = { tab: "logs", range, limit: String(data.get("limit") || "200") };
    try {
      if (range === "duration") next.duration = String(data.get("duration") || "").trim();
      if (range === "dates") {
        for (const field of ["start", "end"]) {
          next[field] = localLogDateToUtc(String(data.get(field) || ""));
        }
      }
      resolvePlayerLogRange(next);
      setError("");
      startTransition(() => {
        const target = `${pathname}?${new URLSearchParams(next)}`;
        if (target === `${window.location.pathname}${window.location.search}`) router.refresh();
        else router.push(target, { scroll: false });
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid time range.");
    }
  }

  return (
    <form onSubmit={apply} className="space-y-3" aria-busy={pending}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="log-range">Time range</Label>
          <select id="log-range" className={selectClass} value={range} onChange={(event) => setRange(event.target.value)}>
            {LOG_RANGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        {range === "duration" && <div className="space-y-1">
          <Label htmlFor="log-duration">Look back</Label>
          <Input id="log-duration" name="duration" required placeholder="90m or 1h30m" defaultValue={readLogParam(params.duration)} />
        </div>}
        {range === "dates" && ["start", "end"].map((field) => <div key={`${field}-${mounted}`} className="space-y-1">
          <Label htmlFor={`log-${field}`}>{field === "start" ? "Start" : "End"} ({timezone})</Label>
          <Input id={`log-${field}`} name={field} type="datetime-local" step="1" required
            defaultValue={mounted ? localLogDateInput(readLogParam(params[field])) : ""} />
        </div>)}
        <div className="space-y-1">
          <Label htmlFor="log-limit">Result limit</Label>
          <select id="log-limit" name="limit" className={selectClass} defaultValue={readLogParam(params.limit) || "200"}>
            <option value="200">200</option><option value="500">500</option><option value="1000">1,000</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Times are shown in {timezone}. Custom durations support seconds (s), minutes (m), hours (h), and days (d).</p>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={pending}>Apply</Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => startTransition(() => router.refresh())}>Refresh</Button>
        {pending && <span role="status" className="text-sm text-muted-foreground">Loading logs…</span>}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </form>
  );
}

export function PlayerLogResults({ entries, start, end, limit }: {
  entries: Record<string, string>[]; start: string; end: string; limit: number;
}) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  function time(value: string) {
    const date = new Date(value);
    return mounted && Number.isFinite(date.getTime()) ? date.toLocaleString() : value;
  }
  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground">{entries.length} entries · {time(start)} – {time(end)} · newest first</p>
    {entries.length >= limit && <p className="text-sm text-muted-foreground">Result limit reached. Narrow the time range or increase the limit to see more.</p>}
    {entries.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No logs matched this player in the selected time range.</p> :
      <div className="space-y-2">{entries.map((entry, index) => <details key={`${entry._time}-${index}`} className="rounded-md border border-border bg-surface-2">
        <summary className="cursor-pointer p-3 focus-ring">
          <span className="text-xs text-muted-foreground">{time(entry._time)} · {entry.resource || "Unknown resource"}</span>
          <span className="mt-1 block break-words text-xs font-medium text-primary">{entry.event || "Event"}</span>
          <span className="mt-1 block whitespace-pre-wrap break-words text-sm">{entry._msg || "No message"}</span>
        </summary>
        <div className="space-y-3 border-t border-border p-3">
          {entry.tags && <div className="flex flex-wrap gap-1" aria-label="Parsed tags">{entry.tags.split(",").map((tag, i) =>
            <span key={i} className="max-w-full break-all rounded border border-border px-2 py-1 font-mono text-xs">{tag}</span>
          )}</div>}
          <dl className="space-y-2">{Object.entries(entry).map(([field, value]) => <div key={field}>
            <dt className="text-xs font-semibold text-muted-foreground">{field}</dt>
            <dd className="whitespace-pre-wrap break-all font-mono text-xs">{value}</dd>
          </div>)}</dl>
        </div>
      </details>)}</div>}
  </div>;
}
