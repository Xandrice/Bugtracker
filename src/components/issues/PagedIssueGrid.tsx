"use client";

import { Fragment, useEffect, useRef, useState, useTransition, type ReactNode, type SelectHTMLAttributes } from "react";
import Link from "next/link";
import { CalendarClock, ChevronDown, ChevronRight, GitBranch, ListFilter, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { bulkUpdateIssues, updateIssueAssignee, updateIssueWorkflow } from "@/app/actions";
import { refreshIssueGroups, retainMatchingSelection } from "@/lib/issue-list-refresh";
import { loadIssueChildren } from "@/app/issue-list-actions";
import { deleteSavedView, saveSavedView, type SavedViewFilters } from "@/app/staff-actions";
import type { IssueListPage, IssueListRow } from "@/lib/issue-list";
import { ISSUE_LIST_SORTS, issueListSearchParams, type IssueListState } from "@/lib/issue-list-state";
import { ISSUE_ENUMS } from "@/lib/issue-validation";
import { formatIssueRef } from "@/lib/issue-ids";
import { STATUS_META, TYPE_META, PRIORITY_META, normalizePriority, normalizeStatus, normalizeType, type IssuePriority, type IssueStatus } from "@/lib/issue-tokens";
import { cn } from "@/components/ui/cn";
import { formatRelativeTime } from "@/lib/time";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, BADGE_TONES, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type User = { id: string; name: string | null };
type Saved = { id: string; name: string; filters: SavedViewFilters };
const control = "h-8 max-w-full rounded-md border border-input bg-elevated px-2 text-xs text-foreground focus-ring";
const activeControl = "h-8 max-w-full rounded-md border px-2 text-xs font-medium focus-ring bg-primary/12! text-primary! border-primary/40";

// Medium gets a colour here too, so the common case doesn't read as grey.
const PRIORITY_TONE: Record<IssuePriority, BadgeTone> = { URGENT: "danger", HIGH: "warning", MEDIUM: "primary", LOW: "neutral" };
const PRIORITY_STRIPE: Record<IssuePriority, string> = {
  URGENT: "shadow-[inset_3px_0_0_var(--danger)]",
  HIGH: "shadow-[inset_3px_0_0_var(--warning)]",
  MEDIUM: "shadow-[inset_3px_0_0_color-mix(in_srgb,var(--primary)_45%,transparent)]",
  LOW: "",
};
const STATUS_COLOR: Record<IssueStatus, string> = { BACKLOG: "rgb(149 125 255)", OPEN: "var(--info)", IN_PROGRESS: "var(--warning)", REVIEW: "var(--primary)", DONE: "var(--success)" };
const isStatus = (value: string): value is IssueStatus => value in STATUS_META;
// Tints each status option in the native dropdown list (honoured by Chromium and Firefox).
function StatusOptions({ prefix = "" }: { prefix?: string }) {
  return <>{ISSUE_ENUMS.status.map((v) => <option key={v} value={v} style={{ color: STATUS_COLOR[normalizeStatus(v)] }}>{prefix}{STATUS_META[normalizeStatus(v)].label}</option>)}</>;
}
const AVATAR_TONES: BadgeTone[] = ["primary", "success", "warning", "danger", "info", "purple"];
function avatarTone(key: string) {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return BADGE_TONES[AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length]];
}

// Native select dressed as a tinted pill with a leading icon, so inline edits keep their colour.
function ToneSelect({ tone, icon, className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement> & { tone: BadgeTone; icon: ReactNode }) {
  return <span className={cn("relative inline-flex h-7 items-center rounded-md border transition-colors focus-within:ring-2 focus-within:ring-ring/50", BADGE_TONES[tone], className)}>
    <span className="pointer-events-none absolute left-2 flex [&_svg]:text-current!">{icon}</span>
    <select {...props} className="h-full cursor-pointer appearance-none rounded-md border-0 bg-transparent! pl-7 pr-6 text-xs font-medium text-inherit! outline-none disabled:cursor-wait" />
    <ChevronDown className="pointer-events-none absolute right-1.5 h-3 w-3 opacity-60" />
  </span>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
function dueTone(value: Date | null, status: string): { className: string; label?: string } {
  if (!value) return { className: "text-subtle-foreground" };
  if (status === "DONE") return { className: "text-muted-foreground" };
  const days = Math.floor((new Date(value).getTime() - Date.now()) / DAY_MS);
  if (days < 0) return { className: "font-medium text-danger", label: "Overdue" };
  if (days <= 3) return { className: "font-medium text-warning", label: days === 0 ? "Due today" : `Due in ${days}d` };
  return { className: "text-foreground" };
}

export function PagedIssueGrid({ page, users, canEdit, canAssign, signedIn, savedViews }: {
  page: IssueListPage; users: User[]; canEdit: boolean; canAssign: boolean; signedIn: boolean; savedViews: Saved[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [groups, setGroups] = useState(page.groups);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(savedViews);
  const [viewName, setViewName] = useState("");
  const [bulk, setBulk] = useState<Record<string, string>>({});
  const [query, setQuery] = useState(page.state.q);
  const previousPage = useRef(page);
  useEffect(() => {
    if (previousPage.current === page) return;
    previousPage.current = page;
    let cancelled = false;
    startTransition(async () => {
      try {
        const filters = Object.fromEntries(issueListSearchParams(page.state, page.scope));
        const refreshed = await refreshIssueGroups(groups, page.groups, async (id, offset) => {
          const result = await loadIssueChildren(id, filters, page.scope, offset);
          if (result.error) throw new Error(result.error);
          return result.rows || [];
        });
        if (!cancelled) {
          setGroups(refreshed);
          setSelected((current) => retainMatchingSelection(current, refreshed));
        }
      } catch {
        if (!cancelled) {
          setGroups(page.groups);
          setSelected([]);
          setFailure(true);
          setMessage("Issue rows refreshed, but expanded subtasks could not be reloaded. Expand them again to retry.");
        }
      }
    });
    return () => { cancelled = true; };
    // Reconcile on server refresh, not when users expand or select existing rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
  const state = page.state;
  const params = Object.fromEntries(issueListSearchParams(state, page.scope));
  const navigate = (changes: Partial<IssueListState>, push = true) => {
    const next = { ...state, ...changes, page: changes.page ?? 1 };
    setSelected([]); setMessage(""); setRowErrors({}); setQuery(next.q);
    const href = `${pathname}?${issueListSearchParams(next, page.scope)}`;
    startTransition(() => push ? router.push(href, { scroll: false }) : router.replace(href, { scroll: false }));
  };
  const visible = groups.flatMap((group) => [group.parent, ...(group.expanded ? group.children : [])]).filter((row) => row.matches);
  const allSelected = visible.length > 0 && visible.every((row) => selected.includes(row.id));
  const select = (id: string, checked: boolean) => setSelected((previous) => checked ? [...new Set([...previous, id])] : previous.filter((value) => value !== id));

  function edit(row: IssueListRow, field: string, value: string) {
    setRowErrors((previous) => ({ ...previous, [row.id]: "" }));
    startTransition(async () => {
      try {
        const result = field === "assigneeId" ? await updateIssueAssignee(row.id, value || null) : await updateIssueWorkflow(row.id, { [field]: value });
        if (result.error) setRowErrors((previous) => ({ ...previous, [row.id]: result.error! }));
      } catch { setRowErrors((previous) => ({ ...previous, [row.id]: "Could not confirm the save. Reloading the current server values; retry if needed." })); }
      finally { router.refresh(); }
    });
  }
  function children(parentId: string, offset: number) {
    startTransition(async () => {
      try {
        const result = await loadIssueChildren(parentId, params, page.scope, offset);
        if (result.error) throw new Error(result.error);
        setGroups((previous) => previous.map((g) => g.parent.id === parentId ? { ...g, expanded: true, children: offset ? [...g.children, ...(result.rows || [])] : result.rows || [] } : g));
      } catch { setRowErrors((previous) => ({ ...previous, [parentId]: "Could not load subtasks. Expand again to retry." })); }
    });
  }
  function applyBulk() {
    const updates = Object.fromEntries(Object.entries(bulk).filter(([, value]) => value !== ""));
    if (updates.assigneeId === "none") updates.assigneeId = "";
    setMessage("");
    startTransition(async () => {
      try {
        const result = await bulkUpdateIssues(selected, updates);
        const skipped = result.skipped || [];
        setFailure(!!result.error || skipped.length > 0);
        setMessage(result.error || `${result.updated} updated${skipped.length ? `; ${skipped.length} failed. ${skipped.map((r) => `${r.id}: ${r.error}`).join(" ")}` : "."}`);
        if (!result.error) {
          setSelected(skipped.map((row) => row.id));
          setRowErrors(Object.fromEntries(skipped.map((row) => [row.id, row.error])));
          if (!skipped.length) setBulk({});
        }
      } catch { setFailure(true); setMessage("Could not confirm the bulk result. Reloading server values before you retry."); }
      finally { router.refresh(); }
    });
  }
  const formatDate = (value: Date | null) => value ? new Date(value).toISOString().slice(0, 10) : "Not set";
  function renderRow(row: IssueListRow, child = false) {
    const context = !row.matches;
    const group = groups.find((g) => g.parent.id === row.id);
    const ref = formatIssueRef(row.publicKey, row.id);
    const type = TYPE_META[normalizeType(row.type)];
    const statusKey = normalizeStatus(row.status);
    const status = STATUS_META[statusKey];
    const priorityKey = normalizePriority(row.priority);
    const priority = PRIORITY_META[priorityKey];
    const done = row.status === "DONE";
    const due = dueTone(row.dueDate, row.status);
    const isSelected = selected.includes(row.id);
    return <Fragment key={row.id}>
      <tr className={`border-t border-border transition-colors ${context ? "bg-muted/30 opacity-75" : isSelected ? "bg-primary/8" : "hover:bg-primary/5"}`}>
        <td className={`p-2 pl-3 ${context ? "" : PRIORITY_STRIPE[priorityKey]}`}>{canEdit && !context && <input type="checkbox" className="accent-primary" aria-label={`Select ${row.title}`} checked={isSelected} disabled={pending} onChange={(event) => select(row.id, event.target.checked)} />}</td>
        <td className="whitespace-nowrap p-2 font-mono text-xs"><Link className="text-muted-foreground transition-colors hover:text-primary focus-ring" href={`/issues/${ref}`}>{ref}</Link></td>
        <td className="p-2">{canEdit && !context ? <ToneSelect tone={type.tone} icon={type.icon} aria-label={`Type for ${row.title}`} value={row.type} disabled={pending} onChange={(e) => edit(row, "type", e.target.value)}>{ISSUE_ENUMS.type.map((v) => <option key={v} value={v}>{TYPE_META[normalizeType(v)].label}</option>)}</ToneSelect> : <Badge tone={type.tone}>{type.icon} {type.label}</Badge>}</td>
        <td className={`min-w-56 p-2 ${child ? "pl-7" : ""}`}>
          <div className="flex items-start gap-2">
            {child && <span aria-hidden className="mt-0.5 text-subtle-foreground">└</span>}
            {!child && row.childCount > 0 && <button type="button" aria-label={`${group?.expanded ? "Collapse" : "Expand"} subtasks for ${row.title}`} aria-expanded={!!group?.expanded} disabled={pending} onClick={() => {
              if (group?.expanded) setGroups((previous) => previous.map((g) => g.parent.id === row.id ? { ...g, expanded: false } : g));
              else children(row.id, 0);
            }} className="mt-0.5 rounded p-0.5 text-muted-foreground transition-colors hover:bg-primary/12 hover:text-primary focus-ring">{group?.expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</button>}
            <div className="min-w-0"><Link className={`break-words font-medium transition-colors hover:text-primary focus-ring ${done ? "text-muted-foreground line-through decoration-success/60" : ""}`} href={`/issues/${ref}`}>{row.title}</Link>
              {context && <p className="text-[11px] italic text-muted-foreground">Parent context · does not match filters</p>}
              {(row.childCount > 0 || row.resourceName) && <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {row.childCount > 0 && <Badge size="xs" tone="purple"><GitBranch className="h-3 w-3" />{row.childCount} matching subtasks</Badge>}
                {row.resourceName && <Badge size="xs" tone="neutral" className="font-mono">{row.resourceName}</Badge>}
              </div>}
            </div>
          </div>
        </td>
        <td className="p-2">{canEdit && !context ? <ToneSelect tone={status.tone} icon={status.icon} aria-label={`Status for ${row.title}`} value={row.status} disabled={pending} onChange={(e) => edit(row, "status", e.target.value)}><StatusOptions /></ToneSelect> : <Badge tone={status.tone}>{status.icon} {status.label}</Badge>}</td>
        <td className="p-2">{canEdit && !context ? <ToneSelect tone={PRIORITY_TONE[priorityKey]} icon={priority.icon} aria-label={`Priority for ${row.title}`} value={row.priority} disabled={pending} onChange={(e) => edit(row, "priority", e.target.value)}>{ISSUE_ENUMS.priority.map((v) => <option key={v} value={v}>{PRIORITY_META[normalizePriority(v)].short} · {PRIORITY_META[normalizePriority(v)].label}</option>)}</ToneSelect> : <Badge tone={PRIORITY_TONE[priorityKey]} className="[&_svg]:text-current!">{priority.icon} {priority.short} · {priority.label}</Badge>}</td>
        <td className="p-2"><div className="flex items-center gap-2">
          <Avatar size="sm" name={row.assigneeName || undefined} className={row.assigneeId ? avatarTone(row.assigneeId) : "border-dashed text-subtle-foreground"} />
          {canAssign && !context ? <select className={control} aria-label={`Assignee for ${row.title}`} value={row.assigneeId || ""} disabled={pending} onChange={(e) => edit(row, "assigneeId", e.target.value)}><option value="">Unassigned</option>{row.assigneeId && !users.some((u) => u.id === row.assigneeId) && <option value={row.assigneeId}>{row.assigneeName || "Current assignee"}</option>}{users.map((u) => <option key={u.id} value={u.id}>{u.name || "Unnamed"}</option>)}</select> : <span className={`text-xs ${row.assigneeId ? "" : "text-muted-foreground"}`}>{row.assigneeName || "Unassigned"}</span>}
        </div></td>
        <td className="whitespace-nowrap p-2 text-xs" suppressHydrationWarning>
          <span className={`inline-flex items-center gap-1 ${due.className}`} title={due.label}>{due.label && <CalendarClock className="h-3.5 w-3.5" />}{formatDate(row.dueDate)}</span>
          {due.label && <span className={`block text-[10px] ${due.className}`}>{due.label}</span>}
        </td>
        <td className="whitespace-nowrap p-2 text-xs text-muted-foreground" title={new Date(row.updatedAt).toLocaleString()} suppressHydrationWarning>{formatRelativeTime(row.updatedAt)}</td>
      </tr>
      {rowErrors[row.id] && <tr><td colSpan={9} role="alert" className="p-2 text-xs text-danger">{rowErrors[row.id]}</td></tr>}
    </Fragment>;
  }

  return <div className="space-y-3" aria-busy={pending}>
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-3 shadow-[inset_0_2px_0_var(--primary)]">
      <form className="relative flex min-w-0 gap-1" onSubmit={(e) => { e.preventDefault(); navigate({ q: query }); }}>
        <Search aria-hidden className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-7" aria-label="Search issue titles and keys" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search titles or keys" />
        <Button type="submit" disabled={pending}>Search</Button>
      </form>
      <ToneSelect className="h-8" tone={isStatus(state.status) ? STATUS_META[state.status].tone : "neutral"} icon={isStatus(state.status) ? STATUS_META[state.status].icon : <ListFilter className="h-3.5 w-3.5" />} aria-label="Filter status" value={state.status} disabled={pending} onChange={(e) => navigate({ status: e.target.value })}><option value="ALL">Status: All</option><option value="ACTIVE">Status: Active</option><StatusOptions prefix="Status: " /></ToneSelect>
      <select className={state.type === "ALL" ? control : activeControl} aria-label="Filter type" value={state.type} disabled={pending} onChange={(e) => navigate({ type: e.target.value })}>{["ALL", ...ISSUE_ENUMS.type].map((v) => <option key={v} value={v}>Type: {v}</option>)}</select>
      <select className={state.assignee === "ALL" ? control : activeControl} aria-label="Filter assignee" value={state.assignee} disabled={pending} onChange={(e) => navigate({ assignee: e.target.value })}><option value="ALL">Anyone</option><option value="UNASSIGNED">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name || "Unnamed"}</option>)}{!["ALL", "UNASSIGNED", ...users.map((u) => u.id)].includes(state.assignee) && <option value={state.assignee}>Selected assignee</option>}</select>
      <Button disabled={pending} onClick={() => navigate({ q: "", status: page.scope === "all" ? "ACTIVE" : "ALL", type: "ALL", assignee: "ALL", sort: "updatedAt", direction: "desc" })}>Clear filters</Button>
      <p className="ml-auto text-xs text-muted-foreground"><span className="rounded-full bg-primary/12 px-2 py-0.5 font-semibold text-primary">{page.matchingCount}</span> matching issues in {page.groupCount} parent groups</p>
    </div>
    {signedIn && <div className="flex flex-wrap items-center gap-2">
      {saved.map((view) => <span key={view.id} className="inline-flex gap-1">
        <Button disabled={pending} onClick={() => navigate({ status: view.filters.status || (page.scope === "all" ? "ACTIVE" : "ALL"), type: view.filters.type || "ALL", assignee: view.filters.assignee || "ALL", q: view.filters.search || "", sort: ISSUE_LIST_SORTS.includes(view.filters.sort as IssueListState["sort"]) ? view.filters.sort as IssueListState["sort"] : "updatedAt", direction: view.filters.direction === "asc" ? "asc" : "desc" })}>{view.name}</Button>
        <Button aria-label={`Delete saved view ${view.name}`} disabled={pending} onClick={() => startTransition(async () => { try { const result = await deleteSavedView(view.id); if (result.error) throw new Error(result.error); setSaved((previous) => previous.filter((v) => v.id !== view.id)); } catch { setFailure(true); setMessage("Could not delete saved view."); } })}>×</Button>
      </span>)}
      <Input className="max-w-48" aria-label="Saved view name" value={viewName} placeholder="Name this view" onChange={(e) => setViewName(e.target.value)} />
      <Button disabled={pending || !viewName.trim()} onClick={() => startTransition(async () => {
        try {
          const filters = { status: state.status, type: state.type, assignee: state.assignee, search: state.q, sort: state.sort, direction: state.direction };
          const result = await saveSavedView(viewName, filters);
          if (result.error || !result.view) throw new Error(result.error);
          setSaved((previous) => [...previous.filter((v) => v.id !== result.view.id), { id: result.view.id, name: result.view.name, filters }]); setViewName("");
        } catch { setFailure(true); setMessage("Could not save this view."); }
      })}>Save view</Button>
    </div>}
    {selected.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/8 p-3">
      <span className="text-xs font-semibold text-primary">{selected.length} selected</span>
      <ToneSelect aria-label="Bulk status" tone={bulk.status && isStatus(bulk.status) ? STATUS_META[bulk.status].tone : "neutral"} icon={bulk.status && isStatus(bulk.status) ? STATUS_META[bulk.status].icon : <ListFilter className="h-3.5 w-3.5" />} value={bulk.status || ""} onChange={(e) => setBulk((prev) => ({ ...prev, status: e.target.value }))} disabled={pending}><option value="">Keep status</option><StatusOptions /></ToneSelect>
      {(["type", "priority"] as const).map((field) => <select key={field} aria-label={`Bulk ${field}`} className={control} value={bulk[field] || ""} onChange={(e) => setBulk((prev) => ({ ...prev, [field]: e.target.value }))} disabled={pending}><option value="">Keep {field}</option>{ISSUE_ENUMS[field].map((v) => <option key={v}>{v}</option>)}</select>)}
      {canAssign && <select aria-label="Bulk assignee" className={control} value={bulk.assigneeId || ""} onChange={(e) => setBulk((prev) => ({ ...prev, assigneeId: e.target.value }))} disabled={pending}><option value="">Keep assignee</option><option value="none">Unassign</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name || "Unnamed"}</option>)}</select>}
      <Button disabled={pending || selected.length > 100 || !Object.values(bulk).some(Boolean)} onClick={applyBulk}>Apply to selected</Button>
      <Button disabled={pending} onClick={() => setSelected([])}>Clear selection</Button>
      {selected.length > 100 && <p role="alert" className="text-xs text-danger">Select at most 100 issues per update.</p>}
    </div>}
    {pending && <p role="status" className="text-xs text-muted-foreground">Loading current issue data...</p>}
    {message && <p role={failure ? "alert" : "status"} className={`text-sm ${failure ? "text-danger" : "text-muted-foreground"}`}>{message}</p>}
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full text-left text-sm"><thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-muted-foreground"><tr>
        <th className="p-2 pl-3">{canEdit && <input type="checkbox" aria-label="Select visible matching issues" checked={allSelected} disabled={pending} onChange={(e) => setSelected(e.target.checked ? visible.map((row) => row.id) : [])} />}</th>
        {(["id", "type", "title", "status", "priority", "assignee", "dueDate", "updatedAt"] as const).map((field) => <th key={field} className={`p-2 font-semibold ${state.sort === field ? "text-primary" : ""}`} aria-sort={state.sort === field ? state.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" className="whitespace-nowrap uppercase tracking-wide transition-colors hover:text-foreground focus-ring" disabled={pending} onClick={() => navigate({ sort: field, direction: state.sort === field && state.direction === "desc" ? "asc" : "desc" })}>{({ id: "Key", type: "Type", title: "Title", status: "Status", priority: "Priority", assignee: "Assignee", dueDate: "Due", updatedAt: "Updated" })[field]}{state.sort === field ? state.direction === "asc" ? " ↑" : " ↓" : ""}</button></th>)}
      </tr></thead><tbody>
        {!groups.length && <tr><td colSpan={9} className="p-10 text-center text-muted-foreground"><Search className="mx-auto mb-2 h-6 w-6 text-primary/60" />No issues match these filters.</td></tr>}
        {groups.map((group) => <Fragment key={group.parent.id}>
          {renderRow(group.parent)}
          {group.expanded && group.children.map((row) => renderRow(row, true))}
          {group.expanded && group.children.length < group.parent.childCount && <tr><td colSpan={9} className="p-2 pl-8"><Button disabled={pending} onClick={() => children(group.parent.id, group.children.length)}>Show more subtasks ({group.children.length} of {group.parent.childCount})</Button></td></tr>}
        </Fragment>)}
      </tbody></table>
    </div>
    <nav aria-label="Issue pages" className="flex items-center justify-between gap-3">
      <Button disabled={pending || state.page === 1} onClick={() => navigate({ page: state.page - 1 })}>Previous</Button>
      <span className="text-xs text-muted-foreground">Page {state.page} of {page.pageCount} · up to 50 parent groups per page</span>
      <Button disabled={pending || state.page >= page.pageCount} onClick={() => navigate({ page: state.page + 1 })}>Next</Button>
    </nav>
  </div>;
}
