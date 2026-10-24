"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Flag, List, Plus, Search, X } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { FieldRow, Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/components/ui/cn";
import { calendarDays, formatRoadmapDate, moveMonth, ROADMAP_STATUSES, ROADMAP_STATUS_LABELS, type RoadmapIssue, type RoadmapMilestone, type RoadmapStatus } from "@/lib/roadmap";
import { deleteRoadmapMilestone, saveRoadmapMilestone, searchRoadmapIssues } from "./actions";

const statusColor: Record<string, string> = {
  PLANNED: "border-border bg-muted text-muted-foreground",
  IN_PROGRESS: "border-primary/30 bg-primary/10 text-primary",
  RELEASED: "border-success/30 bg-success/10 text-success",
};

function localCalendarDay() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function subscribeCalendarDay(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
}

function Status({ status }: { status: string }) {
  return <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded border px-1.5 py-0.5 text-[10px] font-medium", statusColor[status] ?? statusColor.PLANNED)}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" />{ROADMAP_STATUS_LABELS[status as RoadmapStatus] ?? status}
  </span>;
}

function MilestoneEditor({ milestone, date, canManage, onClose }: {
  milestone: RoadmapMilestone | null;
  date: string;
  canManage: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [issues, setIssues] = useState<RoadmapIssue[]>(milestone?.issues ?? []);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RoadmapIssue[]>([]);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    if (!canManage || !query.trim()) return;
    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await searchRoadmapIssues(query);
        if (active) { setResults(result.issues); setSearchError(result.error ?? ""); }
      } catch {
        if (active) setSearchError("Could not load issues. Try again.");
      } finally { if (active) setSearching(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, canManage]);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    startTransition(async () => {
      try {
        const result = await saveRoadmapMilestone(form);
        if (result.error) { setError(result.error); return; }
        router.refresh();
        onClose();
      } catch { setError("Could not save this milestone. Your changes are still here; try again."); }
    });
  }

  function remove() {
    if (!milestone) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await deleteRoadmapMilestone(milestone.id);
        if (result.error) { setError(result.error); return; }
        router.refresh();
        onClose();
      } catch { setError("Could not delete this milestone. Try again."); }
    });
  }

  return <dialog ref={dialog} aria-labelledby="milestone-title" onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-lg border border-border bg-elevated p-0 text-foreground shadow-xl backdrop:bg-black/50">
    <div className="flex items-center justify-between border-b border-border px-5 py-4">
      <h2 id="milestone-title" className="font-semibold">{canManage ? milestone ? "Edit milestone" : "New milestone" : "Milestone details"}</h2>
      <Button variant="ghost" size="icon" aria-label="Close milestone" disabled={pending} onClick={onClose}><X className="h-4 w-4" /></Button>
    </div>
    {canManage ? <form onSubmit={save}>
      <fieldset disabled={pending} className="space-y-4 p-5">
        <input type="hidden" name="id" value={milestone?.id ?? ""} />
        <FieldRow label="Milestone name" htmlFor="milestone-name"><Input id="milestone-name" name="name" required maxLength={200} defaultValue={milestone?.name} placeholder="e.g. Economy update" autoFocus /></FieldRow>
        <FieldRow label="Description" htmlFor="milestone-description"><Textarea id="milestone-description" name="description" maxLength={10000} defaultValue={milestone?.description ?? ""} placeholder="What are we working toward?" /></FieldRow>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Target date" htmlFor="milestone-date" hint="Leave empty to keep it unscheduled."><Input id="milestone-date" type="date" name="targetDate" min="1900-01-01" max="9999-12-31" defaultValue={milestone?.targetDate ?? date} /></FieldRow>
          <FieldRow label="Status" htmlFor="milestone-status"><select id="milestone-status" name="status" defaultValue={milestone?.status ?? "PLANNED"} className="h-9 w-full rounded-md border border-input bg-elevated px-3 text-sm focus-ring">{ROADMAP_STATUSES.map((value) => <option key={value} value={value}>{ROADMAP_STATUS_LABELS[value]}</option>)}</select></FieldRow>
        </div>
        <FieldRow label={`Linked issues (${issues.length}/100)`} htmlFor="milestone-issues" hint="Link work to track completion automatically.">
          <Input id="milestone-issues" value={query} maxLength={200} onChange={(event) => { setQuery(event.target.value); setResults([]); setSearchError(""); setSearching(!!event.target.value.trim()); }} placeholder="Search by title or issue key…" />
        </FieldRow>
        {query.trim() && <div aria-live="polite" className="max-h-40 overflow-auto rounded-md border border-border p-1">
          {searching ? <p className="p-2 text-xs text-muted-foreground">Searching…</p> : searchError ? <p role="alert" className="p-2 text-xs text-danger">{searchError}</p> : results.filter((item) => !issues.some((selected) => selected.id === item.id)).length ? results.filter((item) => !issues.some((selected) => selected.id === item.id)).map((issue) => <button type="button" key={issue.id} disabled={issues.length >= 100} onClick={() => { setIssues([...issues, issue]); setQuery(""); setResults([]); }} className="flex w-full gap-2 rounded p-2 text-left text-xs hover:bg-muted focus-ring disabled:opacity-50"><Plus className="h-3.5 w-3.5 shrink-0" /><span>{issue.publicKey && <span className="mr-2 text-muted-foreground">{issue.publicKey}</span>}{issue.title}</span></button>) : <p className="p-2 text-xs text-muted-foreground">No matching issues available to add.</p>}
        </div>}
        {issues.length > 0 && <ul className="space-y-1">{issues.map((issue) => <li key={issue.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs">
          <input type="hidden" name="issueId" value={issue.id} />
          <Link href={`/issues/${issue.id}`} className="min-w-0 flex-1 truncate hover:text-primary">{issue.publicKey ? `${issue.publicKey} · ` : ""}{issue.title}</Link>
          {issue.status === "DONE" && <span className="text-success">Done</span>}
          <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${issue.title}`} onClick={() => setIssues(issues.filter((item) => item.id !== issue.id))}><X className="h-3.5 w-3.5" /></Button>
        </li>)}</ul>}
      </fieldset>
      {error && <p role="alert" className="px-5 pb-4 text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
        {milestone ? <Button type="button" variant="danger" disabled={pending} onClick={() => setConfirmDelete(!confirmDelete)}>Delete milestone</Button> : <span />}
        <div className="flex gap-2"><Button type="button" disabled={pending} onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" loading={pending}>{pending ? "Saving…" : "Save milestone"}</Button></div>
        {confirmDelete && <div className="w-full space-y-2 rounded-md border border-danger/30 bg-danger/10 p-3">
          <p className="text-xs">Delete “{milestone?.name}”? Linked issues will be kept.</p>
          <div className="flex gap-2"><Button type="button" variant="danger" disabled={pending} onClick={remove}>Confirm delete</Button><Button type="button" disabled={pending} onClick={() => setConfirmDelete(false)}>Keep milestone</Button></div>
        </div>}
      </div>
    </form> : <div className="space-y-4 p-5">
      <h3 className="text-lg font-semibold">{milestone?.name}</h3>
      <div className="flex items-center gap-3"><Status status={milestone?.status ?? "PLANNED"} /><span className="text-xs text-muted-foreground">{milestone?.targetDate ? formatRoadmapDate(milestone.targetDate) : "Unscheduled"}</span></div>
      {milestone?.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{milestone.description}</p>}
      {issues.length > 0 && <div className="space-y-2"><h4 className="text-xs font-semibold">Linked issues</h4>{issues.map((issue) => <Link key={issue.id} href={`/issues/${issue.id}`} className="block text-sm hover:text-primary">{issue.publicKey ? `${issue.publicKey} · ` : ""}{issue.title}<span className="ml-2 text-xs text-muted-foreground">{issue.status === "DONE" ? "Done" : "Open"}</span></Link>)}</div>}
    </div>}
  </dialog>;
}

export function RoadmapClient({ milestones, canManage, today: initialToday }: { milestones: RoadmapMilestone[]; canManage: boolean; today: string }) {
  const today = useSyncExternalStore(subscribeCalendarDay, localCalendarDay, () => initialToday);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [selectedMonth, setMonth] = useState<string | null>(null);
  const month = selectedMonth ?? today.slice(0, 7);
  const [status, setStatus] = useState("ALL");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<{ milestone: RoadmapMilestone | null; date: string } | null>(null);
  const filtered = milestones.filter((item) => (status === "ALL" || item.status === status) && `${item.name} ${item.description ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const undated = filtered.filter((item) => !item.targetDate);
  const scheduledThisMonth = filtered.filter((item) => item.targetDate?.startsWith(month));
  const completed = milestones.filter((item) => item.status === "RELEASED").length;
  const overdue = milestones.filter((item) => item.targetDate && item.targetDate < today && item.status !== "RELEASED").length;
  const openMilestone = (milestone: RoadmapMilestone) => setEditor({ milestone, date: milestone.targetDate ?? "" });

  function card(item: RoadmapMilestone) {
    const done = item.issues.filter((issue) => issue.status === "DONE").length;
    const late = item.targetDate && item.targetDate < today && item.status !== "RELEASED";
    return <button key={item.id} onClick={() => openMilestone(item)} className="w-full space-y-2 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-elevated focus-ring">
      <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-sm font-semibold">{item.name}</h3><Status status={item.status} /></div>
      {item.description && <p className="line-clamp-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{item.description}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span className={cn("flex items-center gap-1.5", late && "text-danger")}><CalendarDays className="h-3.5 w-3.5" />{item.targetDate ? formatRoadmapDate(item.targetDate) : "No target date"}{late && " · Overdue"}</span>{item.issues.length > 0 && <span>{done}/{item.issues.length} issues complete</span>}</div>
      {item.issues.length > 0 && <div role="progressbar" aria-label={`${item.name} issue completion`} aria-valuemin={0} aria-valuemax={item.issues.length} aria-valuenow={done} className="h-1 overflow-hidden rounded bg-muted"><div className="h-full bg-success" style={{ width: `${done / item.issues.length * 100}%` }} /></div>}
    </button>;
  }

  return <PageContainer>
    <PageHeader title="Roadmap" description="Plan milestones, set target dates, and see what’s coming next." icon={<Flag className="h-4 w-4" />} actions={canManage && <Button variant="primary" onClick={() => setEditor({ milestone: null, date: "" })}><Plus className="h-3.5 w-3.5" />New milestone</Button>} />
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><span><strong className="text-foreground">{milestones.length}</strong> milestones</span><span><strong className="text-success">{completed}</strong> completed</span>{overdue > 0 && <span className="text-danger"><strong>{overdue}</strong> overdue</span>}</div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div aria-label="Roadmap view" className="flex rounded-md border border-border bg-surface p-0.5">{(["calendar", "list"] as const).map((value) => <Button key={value} size="sm" variant={view === value ? "secondary" : "ghost"} aria-pressed={view === value} onClick={() => setView(value)}>{value === "calendar" ? <CalendarDays className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}{value === "calendar" ? "Calendar" : "List"}</Button>)}</div>
        <Select aria-label="Filter milestone status" value={status} onChange={setStatus} fullWidth={false} options={[{ value: "ALL", label: "All statuses" }, ...ROADMAP_STATUSES.map((value) => ({ value, label: ROADMAP_STATUS_LABELS[value] }))]} />
      </div>
      <div className="relative w-full sm:w-60"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" /><Input aria-label="Search milestones" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search milestones…" className="h-8 pl-8 text-xs" /></div>
    </div>
    {milestones.length === 0 && <div className="rounded-lg border border-dashed border-border bg-surface p-6 text-center"><Flag className="mx-auto mb-2 h-6 w-6 text-muted-foreground" /><h2 className="text-sm font-semibold">Build your roadmap</h2><p className="mt-1 text-xs text-muted-foreground">{canManage ? "Create your first milestone or choose a day on the calendar to start planning." : "Milestones will appear here when the team adds them."}</p></div>}
    {view === "calendar" ? <>
      <section aria-label="Milestone calendar" className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
          <div className="flex items-center gap-1"><Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setMonth(moveMonth(month, -1))}><ChevronLeft className="h-4 w-4" /></Button><h2 aria-live="polite" className="min-w-36 text-center text-sm font-semibold">{formatRoadmapDate(`${month}-01`, { month: "long", year: "numeric" })}</h2><Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setMonth(moveMonth(month, 1))}><ChevronRight className="h-4 w-4" /></Button></div>
          <div className="flex gap-2"><Input type="month" aria-label="Jump to month" value={month} min="1900-01" max="9999-12" onChange={(event) => { if (/^\d{4}-\d{2}$/.test(event.target.value) && event.target.value >= "1900-01" && event.target.value <= "9999-12") setMonth(event.target.value); }} className="h-8 w-40 text-xs" /><Button onClick={() => setMonth(today.slice(0, 7))}>Today</Button></div>
        </div>
        <div className="overflow-x-auto"><div className="min-w-[700px]">
          <div className="grid grid-cols-7 border-b border-border">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{day}</div>)}</div>
          <div className="grid grid-cols-7">{calendarDays(month).map((day) => <div key={day} data-calendar-day={day} className={cn("min-h-28 border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0", !day.startsWith(month) && "bg-background/60", day === today && "bg-primary/5")}>
            <div className="mb-1 flex items-center justify-between"><span aria-label={day === today ? "Today" : undefined} className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px]", day === today ? "bg-primary font-semibold text-primary-foreground" : day.startsWith(month) ? "text-foreground" : "text-subtle-foreground")}>{Number(day.slice(-2))}</span>{canManage && <button aria-label={`Add milestone on ${day}`} onClick={() => setEditor({ milestone: null, date: day })} className="rounded p-1 text-subtle-foreground hover:bg-muted hover:text-foreground focus-ring"><Plus className="h-3 w-3" /></button>}</div>
            <div className="space-y-1">{filtered.filter((item) => item.targetDate === day).map((item) => <button key={item.id} onClick={() => openMilestone(item)} title={`${item.name} · ${ROADMAP_STATUS_LABELS[item.status as RoadmapStatus] ?? item.status}`} className={cn("block w-full rounded border px-1.5 py-1 text-left text-[11px] leading-snug focus-ring", statusColor[item.status] ?? statusColor.PLANNED)}><span className="line-clamp-2 break-words">{item.name}</span></button>)}</div>
          </div>)}</div>
        </div></div>
        <p className="px-3 py-2 text-xs text-muted-foreground">{scheduledThisMonth.length} {scheduledThisMonth.length === 1 ? "milestone" : "milestones"} this month. <span className="sm:hidden">Scroll sideways to see the full week, or use List.</span></p>
      </section>
      {undated.length > 0 && <section aria-label="Unscheduled milestones" className="space-y-3"><h2 className="text-sm font-semibold">Unscheduled <span className="ml-1 text-xs font-normal text-muted-foreground">{undated.length}</span></h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{undated.map(card)}</div></section>}
    </> : <section aria-label="Milestone list" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map(card)}</section>}
    {milestones.length > 0 && filtered.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No milestones match your search and status filter.</p>}
    {editor && <MilestoneEditor milestone={editor.milestone} date={editor.date} canManage={canManage} onClose={() => setEditor(null)} />}
  </PageContainer>;
}
