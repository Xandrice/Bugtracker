"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { searchLogsAction, searchLogPlayers } from "@/app/logs/actions";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DataValue } from "@/components/staff/DataList";
import { CATEGORY_META, LOG_CATEGORIES, describeLogEvent, type LogEntry } from "@/lib/log-events";
import { LOG_RANGES, localLogDateInput, localLogDateToUtc, readLogParam, type PlayerLogParams } from "@/lib/player-logs";
import { formatRelativeTime } from "@/lib/time";
import type { searchLogs } from "@/lib/log-service";

type Results = Awaited<ReturnType<typeof searchLogs>>;
const control = "h-9 rounded-md border border-input bg-elevated px-2 text-sm focus-ring";
const subscribe = () => () => {};

export function LogExplorer({ params, advanced = false, players = false, lockedPlayer }: { params: PlayerLogParams; advanced?: boolean; players?: boolean; lockedPlayer?: string }) {
  const router = useRouter(); const pathname = usePathname();
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const timezone = hydrated ? Intl.DateTimeFormat().resolvedOptions().timeZone : "your local timezone";
  const serialized = JSON.stringify(params);
  const [result, setResult] = useState<Results | null>(null);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const [older, setOlder] = useState(false); const [live, setLive] = useState(false); const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<LogEntry | null>(null); const [copyStatus, setCopyStatus] = useState("");
  const [playerText, setPlayerText] = useState(readLogParam(params.player));
  const [playerOptions, setPlayerOptions] = useState<{ id: string; name: string }[]>([]);
  const generation = useRef(0); const filterRef = useRef(params); filterRef.current = params;
  const rootRef = useRef<HTMLDivElement>(null);
  const range = readLogParam(params.range) || "1h";
  const [draftRange, setDraftRange] = useState(range);
  const mode = readLogParam(params.mode) === "advanced" && advanced ? "advanced" : "guided";

  useEffect(() => {
    const current = ++generation.current; const filters: PlayerLogParams = JSON.parse(serialized);
    setLoading(true); setError(""); setSelected(null); setDraftRange(readLogParam(filters.range) || "1h"); setPlayerText(readLogParam(filters.player));
    searchLogsAction(filters, lockedPlayer).then(data => {
      if (current !== generation.current) return;
      setResult(data); setError(data.error || "");
      const focus = readLogParam(filters.focus); if (focus) setSelected(data.entries.find(entry => entry._time === focus) || null);
    }).catch(cause => { if (current === generation.current) { setResult(null); setError(cause instanceof Error ? cause.message : "Could not load logs. Try again."); } })
      .finally(() => { if (current === generation.current) setLoading(false); });
    return () => { generation.current = current + 1; };
  }, [serialized, lockedPlayer]);
  useEffect(() => {
    if (!live) return;
    let fetching = false;
    const interval = setInterval(async () => {
      let scrolledDown = window.scrollY > 120;
      for (let parent = rootRef.current?.parentElement; parent; parent = parent.parentElement) if (parent.scrollTop > 120) scrolledDown = true;
      if (document.hidden || scrolledDown || loading || older || fetching) { setPaused(true); return; }
      setPaused(false); fetching = true; const current = generation.current;
      try { const data = await searchLogsAction({ ...filterRef.current, before: undefined, offset: undefined }, lockedPlayer); if (current === generation.current) { if (data.error) setError(data.error); else { setResult(data); setError(""); } } }
      catch { setError("Live updates paused because the log server is unavailable. Try Refresh."); }
      finally { fetching = false; }
    }, 5000);
    return () => clearInterval(interval);
  }, [live, lockedPlayer, loading, older]);
  useEffect(() => {
    if (!players || lockedPlayer || playerText.trim().length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => { searchLogPlayers(playerText).then(values => { if (!cancelled) setPlayerOptions(values); }).catch(() => { if (!cancelled) setPlayerOptions([]); }); }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [playerText, players, lockedPlayer]);

  function href(changes: Record<string, string>) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (readLogParam(value)) next.set(key, readLogParam(value));
    next.delete("before"); next.delete("offset"); next.delete("focus");
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key); }
    if (lockedPlayer) { next.set("player", lockedPlayer); next.set("tab", "logs"); }
    return `${pathname}?${next}`;
  }
  function navigate(changes: Record<string, string>) { setLive(false); router.push(href(changes), { scroll: false }); }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    try {
      if (values.range === "dates") { values.start = localLogDateToUtc(values.start); values.end = localLogDateToUtc(values.end); }
      else { values.start = ""; values.end = ""; }
      const target = href(values);
      if (target === `${window.location.pathname}${window.location.search}`) void refresh(); else router.push(target, { scroll: false });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Check your dates."); }
  }
  async function refresh() {
    const current = ++generation.current; setLoading(true); setError("");
    try { const data = await searchLogsAction(params, lockedPlayer); if (current === generation.current) { setResult(data); setError(data.error || ""); } }
    catch (cause) { if (current === generation.current) setError(cause instanceof Error ? cause.message : "Could not refresh logs."); }
    finally { if (current === generation.current) setLoading(false); }
  }
  async function loadOlder() {
    if (!result?.next) return;
    const current = generation.current; setOlder(true);
    try {
      const data = await searchLogsAction({ ...params, range: "dates", start: result.start, end: result.end, ...result.next }, lockedPlayer, true);
      if (data.error) throw new Error(data.error);
      if (current === generation.current) setResult(previous => previous ? { ...previous, entries: [...previous.entries, ...data.entries], next: data.next } : data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load older entries."); }
    finally { setOlder(false); }
  }
  async function copy(value: string) { try { await navigator.clipboard.writeText(value); setCopyStatus("Copied"); } catch { setCopyStatus("Copy failed. Select the text to copy it."); } }
  function permalink(entry: LogEntry) {
    const time = Date.parse(entry._time); if (!Number.isFinite(time)) return window.location.href;
    return new URL(href({ range: "dates", start: new Date(time - 1000).toISOString(), end: new Date(time + 1000).toISOString(), resource: entry.resource || "", event: entry.event || "", focus: entry._time }), window.location.origin).toString();
  }
  const selectedEvent = selected ? describeLogEvent(selected) : null;
  const buckets = new Map<string, Partial<Record<typeof LOG_CATEGORIES[number], number>>>();
  for (const series of result?.hits || []) for (let index = 0; index < series.timestamps.length; index++) {
    const timestamp = series.timestamps[index]; const category = describeLogEvent(series.fields).category; const bucket = buckets.get(timestamp) || {};
    bucket[category] = (bucket[category] || 0) + series.values[index]; buckets.set(timestamp, bucket);
  }
  const timeline = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  const total = (counts: Partial<Record<typeof LOG_CATEGORIES[number], number>>) => Object.values(counts).reduce((sum, count) => sum + (count || 0), 0);
  const max = Math.max(1, ...timeline.map(([, counts]) => total(counts)));

  return <div ref={rootRef} className="space-y-4" aria-busy={loading}>
    {advanced && <div className="flex gap-2" aria-label="Log search mode">{["guided", "advanced"].map(value => <Button key={value} onClick={() => navigate({ mode: value })} variant={mode === value ? "primary" : "outline"}>{value === "guided" ? "Guided" : "Advanced"}</Button>)}</div>}
    <form key={serialized} onSubmit={submit} className="space-y-3 rounded-md border border-border bg-surface p-4">
      <input type="hidden" name="mode" value={mode} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {mode === "guided" ? <>
          <div><Label htmlFor="log-words">Search words</Label><Input id="log-words" name="q" placeholder="money, robbery, error…" defaultValue={readLogParam(params.q)} /></div>
          {(players || lockedPlayer) && <div><Label htmlFor="log-player">Player {lockedPlayer ? "(locked)" : "name or Citizen ID"}</Label><Input id="log-player" name="player" list="log-players" value={lockedPlayer || playerText} readOnly={!!lockedPlayer} onChange={event => setPlayerText(event.target.value)} /><datalist id="log-players">{playerOptions.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}</datalist></div>}
          {["resource", "event"].map(field => <div key={field}><Label htmlFor={`log-${field}`}>{field === "resource" ? "Resource" : "Event"}</Label><Input id={`log-${field}`} name={field} list={`log-${field}-values`} defaultValue={readLogParam(params[field])} /><datalist id={`log-${field}-values`}>{(field === "resource" ? result?.resources : result?.events)?.map(value => <option key={value}>{value}</option>)}</datalist></div>)}
        </> : <>
          <div className="sm:col-span-2"><Label htmlFor="log-raw">LogsQL query</Label><Input id="log-raw" name="raw" defaultValue={readLogParam(params.raw) || "*"} /></div>
          {["accountId", "projectId"].map(field => <div key={field}><Label htmlFor={`log-${field}`}>{field}</Label><Input id={`log-${field}`} name={field} pattern="[0-9]*" defaultValue={readLogParam(params[field])} /></div>)}
        </>}
        <div><Label htmlFor="log-range">Time range</Label><select id="log-range" name="range" className={`${control} w-full`} defaultValue={range} onChange={event => setDraftRange(event.target.value)}>{LOG_RANGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        {draftRange === "duration" && <div><Label htmlFor="log-duration">Duration</Label><Input id="log-duration" name="duration" defaultValue={readLogParam(params.duration)} placeholder="90m or 1h30m" required /></div>}
        {draftRange === "dates" && ["start", "end"].map(field => <div key={field}><Label htmlFor={`log-${field}`}>{field === "start" ? "Start" : "End"} ({timezone})</Label><Input id={`log-${field}`} name={field} type="datetime-local" step="1" defaultValue={hydrated ? localLogDateInput(readLogParam(params[field])) : ""} required /></div>)}
      </div>
      <div className="flex flex-wrap items-center gap-2"><Button type="submit" variant="primary" disabled={loading}>Search logs</Button><Button type="button" onClick={refresh} disabled={loading}>Refresh</Button><span className="text-xs text-muted-foreground">Times shown in {timezone}</span></div>
    </form>
    {mode === "guided" && <><div className="flex flex-wrap gap-1.5" aria-label="Categories"><Button onClick={() => navigate({ category: "" })} variant={!readLogParam(params.category) ? "primary" : "outline"}>All events</Button>{LOG_CATEGORIES.map(category => <Button key={category} variant={readLogParam(params.category) === category ? "primary" : "outline"} onClick={() => navigate({ category })}><span style={{ color: CATEGORY_META[category].color }}>{CATEGORY_META[category].icon}</span>{category}</Button>)}</div>
      <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">Investigate:</span>{[["Money movements", "Money"], ["Items given or removed", "Items"], ["Deaths and kills", "Combat"], ["Connections", "Connections"], ["Staff actions", "Staff actions"], ["Recent errors", "Errors"]].map(([label, category]) => <Button key={label} size="xs" onClick={() => navigate({ category, range: category === "Errors" ? "1h" : "24h" })}>{label}</Button>)}</div></>}
    {error && <div role="alert" className="rounded border border-danger/30 bg-danger/10 p-4 text-sm"><p>{error}</p><Button onClick={refresh} disabled={loading}>Retry</Button></div>}
    {loading ? <div role="status" className="space-y-2"><p className="text-sm text-muted-foreground">Searching logs…</p>{[0,1,2,3].map(value => <div key={value} className="h-14 animate-pulse rounded bg-muted" />)}</div> : <>
      {result?.warning && <p role="status" className="text-xs text-warning">{result.warning}</p>}
      {timeline.length > 0 && <div className="rounded border border-border bg-surface p-4"><p className="mb-3 text-xs text-muted-foreground">Activity timeline · click a bar to investigate that time</p><div className="flex h-24 items-end gap-1">{timeline.map(([timestamp, counts], index) => <button key={timestamp} className="flex min-w-1 flex-1 flex-col justify-end overflow-hidden rounded-sm focus-ring" style={{ height: `${Math.max(3, total(counts) / max * 100)}%` }} aria-label={`Zoom to ${new Date(timestamp).toLocaleString()} (${total(counts)} events)`} title={new Date(timestamp).toLocaleString()} onClick={() => navigate({ range: "dates", start: new Date(timestamp).toISOString(), end: timeline[index + 1]?.[0] || result!.end })}>{Object.entries(counts).map(([category, count]) => <span key={category} style={{ background: CATEGORY_META[category as keyof typeof CATEGORY_META].color, flex: count, minHeight: 2 }} />)}</button>)}</div><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{new Date(result!.start).toLocaleString()}</span><span>{new Date(result!.end).toLocaleString()}</span></div></div>}
      <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
        <aside className="space-y-4 rounded border border-border bg-surface p-3"><h2 className="text-sm font-semibold">Top values</h2>{result?.facets.map(facet => <div key={facet.field_name}><p className="mb-1 text-xs font-semibold capitalize">{facet.field_name}</p>{facet.values.map(value => <div key={value.field_value} className="flex items-center gap-1 text-xs"><button className="min-w-0 flex-1 truncate py-1 text-left hover:text-primary focus-ring" onClick={() => navigate({ [facet.field_name]: value.field_value })} title={`Include ${value.field_value}`}>{value.field_value || "(empty)"} <span className="text-muted-foreground">{value.hits}</span></button><button aria-label={`Exclude ${facet.field_name} ${value.field_value}`} className="p-1 text-muted-foreground hover:text-danger" onClick={() => navigate({ [facet.field_name === "resource" ? "excludeResource" : "excludeEvent"]: value.field_value })}>−</button></div>)}</div>)}{["excludeResource", "excludeEvent"].map(field => readLogParam(params[field]) && <Button key={field} size="xs" onClick={() => navigate({ [field]: "" })}>Clear exclusion: {readLogParam(params[field])}</Button>)}</aside>
        <div className="min-w-0 space-y-3"><div className="flex flex-wrap items-center gap-3"><span className="text-xs text-muted-foreground">{result?.entries.length || 0} entries loaded</span><label className="text-xs"><input type="checkbox" checked={live} disabled={range === "dates" || mode === "advanced"} onChange={event => setLive(event.target.checked)} /> Live tail {live && paused ? "(paused while away or scrolled down)" : ""}</label><Link href={`/api/logs/export?${new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([key,value]) => [key, readLogParam(value)])), ...(lockedPlayer ? { player: lockedPlayer } : {}), ...(result ? { range: "dates", start: result.start, end: result.end } : {}) })}`} className="ml-auto text-xs text-primary underline">Export CSV (up to 1,000)</Link></div>
          <div className="divide-y divide-border overflow-hidden rounded border border-border bg-surface">{result?.entries.length ? result.entries.map((entry, index) => {
            const event = describeLogEvent(entry); const date = new Date(entry._time);
            return <div key={`${entry._time}-${index}`} className="flex items-start gap-3 px-3 py-3 hover:bg-muted/40"><span aria-hidden className="mt-1 w-5 text-center font-semibold" style={{ color: event.color }}>{event.icon}</span><div className="min-w-0 flex-1"><button onClick={() => { setSelected(entry); setCopyStatus(""); }} className="w-full text-left text-sm font-medium focus-ring">{event.summary}</button><div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground"><time dateTime={entry._time} title={Number.isFinite(date.getTime()) ? date.toLocaleString() : "Unknown time"}>{Number.isFinite(date.getTime()) ? `${date.toLocaleString()} · ${formatRelativeTime(date)}` : "Unknown time"}</time><span className="rounded border border-border px-1">{event.resource}</span>{event.playerId && players && <Link className="text-primary hover:underline" href={`/staff-tools/players/${encodeURIComponent(event.playerId)}`}>{event.playerName || event.playerId}</Link>}</div></div></div>;
          }) : !error && <p className="p-8 text-center text-sm text-muted-foreground">No events matched. Try a longer time range or fewer filters.</p>}</div>
          {result?.next && <Button disabled={older || live} onClick={loadOlder}>{older ? "Loading older events…" : "Load older"}</Button>}
        </div>
      </div>
      {advanced && result?.logsQL && <details className="rounded border border-border p-3"><summary className="cursor-pointer text-sm">Show as LogsQL</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs">{result.logsQL}</pre><Button size="xs" onClick={() => copy(result.logsQL!)}>Copy query</Button></details>}
      {advanced && result?.debug && <details className="rounded border border-border p-3"><summary className="cursor-pointer text-sm">Connection details</summary><DataValue value={result.debug} /></details>}
    </>}
    {selected && selectedEvent && <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setSelected(null)}><section role="dialog" aria-modal="true" aria-labelledby="log-detail-title" className="absolute inset-y-0 right-0 w-full max-w-xl overflow-auto border-l border-border bg-surface p-5 shadow-xl" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") setSelected(null); }} tabIndex={-1} ref={element => element?.focus()}>
      <div className="flex items-start justify-between gap-3"><h2 id="log-detail-title" className="text-lg font-semibold">{selectedEvent.summary}</h2><Button onClick={() => setSelected(null)} aria-label="Close log details">Close</Button></div>
      <div className="my-4 flex flex-wrap gap-2"><Button onClick={() => copy(JSON.stringify(selectedEvent.fields, null, 2))}>Copy event</Button><Button onClick={() => copy(permalink(selected))}>Copy permalink</Button><Button onClick={() => { navigate({ resource: selectedEvent.resource, event: selectedEvent.event }); setSelected(null); }}>Filter to this event</Button>{selectedEvent.playerId && players && <Button onClick={() => { const time = Date.parse(selected._time); navigate({ player: selectedEvent.playerId!, range: "dates", start: new Date(time - 300000).toISOString(), end: new Date(time + 300000).toISOString() }); setSelected(null); }}>This player ±5 minutes</Button>}</div>
      {copyStatus && <p role="status" className="text-xs text-muted-foreground">{copyStatus}</p>}
      <div className="mb-4 flex gap-3 text-xs"><Link className="text-primary underline" href={`/reports/new?evidenceLinks=${encodeURIComponent(permalink(selected))}&description=${encodeURIComponent(selectedEvent.summary)}${selectedEvent.playerId ? `&subjectName=${encodeURIComponent(selectedEvent.playerName || selectedEvent.playerId)}` : ""}`}>Attach to mod log</Link><Link className="text-primary underline" href={`/issues/new?description=${encodeURIComponent(`${selectedEvent.summary}\n\nEvidence: ${permalink(selected)}`)}`}>Attach to issue</Link></div>
      <dl className="space-y-3">{Object.entries(selectedEvent.fields).filter(([key]) => !key.startsWith("_") || key === "_time" || key === "_msg").map(([key,value]) => <div key={key} className="border-b border-border pb-2"><dt className="text-xs font-medium capitalize text-muted-foreground">{key.replace(/_/g, " ")}</dt><dd className="mt-1 flex items-start justify-between gap-2"><DataValue value={value} /><button onClick={() => copy(value)} aria-label={`Copy ${key}`} className="text-xs text-primary">Copy</button></dd></div>)}</dl>
    </section></div>}
  </div>;
}
