"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { bulkUpdateIssues, updateIssueAssignee, updateIssueWorkflow } from "@/app/actions";
import { refreshIssueGroups, retainMatchingSelection } from "@/lib/issue-list-refresh";
import { loadIssueChildren } from "@/app/issue-list-actions";
import { deleteSavedView, saveSavedView, type SavedViewFilters } from "@/app/staff-actions";
import type { IssueListPage, IssueListRow } from "@/lib/issue-list";
import { ISSUE_LIST_SORTS, issueListSearchParams, type IssueListState } from "@/lib/issue-list-state";
import { ISSUE_ENUMS } from "@/lib/issue-validation";
import { formatIssueRef } from "@/lib/issue-ids";
import { STATUS_META, TYPE_META, PRIORITY_META, normalizePriority, normalizeStatus, normalizeType } from "@/lib/issue-tokens";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type User = { id: string; name: string | null };
type Saved = { id: string; name: string; filters: SavedViewFilters };
const control = "h-8 max-w-full rounded-md border border-input bg-elevated px-2 text-xs text-foreground focus-ring";

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
    return <Fragment key={row.id}>
      <tr className={`border-t border-border ${context ? "bg-muted/30" : "hover:bg-muted/30"}`}>
        <td className="p-2">{canEdit && !context && <input type="checkbox" aria-label={`Select ${row.title}`} checked={selected.includes(row.id)} disabled={pending} onChange={(event) => select(row.id, event.target.checked)} />}</td>
        <td className="p-2 font-mono text-xs text-muted-foreground"><Link href={`/issues/${formatIssueRef(row.publicKey, row.id)}`}>{formatIssueRef(row.publicKey, row.id)}</Link></td>
        <td className="p-2">{canEdit && !context ? <select aria-label={`Type for ${row.title}`} className={control} value={row.type} disabled={pending} onChange={(e) => edit(row, "type", e.target.value)}>{ISSUE_ENUMS.type.map((v) => <option key={v}>{v}</option>)}</select> : TYPE_META[normalizeType(row.type)].label}</td>
        <td className={`min-w-56 p-2 ${child ? "pl-7" : ""}`}>
          <div className="flex items-start gap-2">
            {!child && row.childCount > 0 && <button type="button" aria-label={`${group?.expanded ? "Collapse" : "Expand"} subtasks for ${row.title}`} aria-expanded={!!group?.expanded} disabled={pending} onClick={() => {
              if (group?.expanded) setGroups((previous) => previous.map((g) => g.parent.id === row.id ? { ...g, expanded: false } : g));
              else children(row.id, 0);
            }} className="focus-ring">{group?.expanded ? "−" : "+"}</button>}
            <div><Link className="break-words font-medium hover:text-primary focus-ring" href={`/issues/${formatIssueRef(row.publicKey, row.id)}`}>{row.title}</Link>
              {context && <p className="text-[11px] text-muted-foreground">Parent context · does not match filters</p>}
              {row.childCount > 0 && <p className="text-[11px] text-muted-foreground">{row.childCount} matching subtasks</p>}
              {row.resourceName && <p className="text-[11px] text-muted-foreground">{row.resourceName}</p>}
            </div>
          </div>
        </td>
        <td className="p-2">{canEdit && !context ? <select className={control} aria-label={`Status for ${row.title}`} value={row.status} disabled={pending} onChange={(e) => edit(row, "status", e.target.value)}>{ISSUE_ENUMS.status.map((v) => <option key={v} value={v}>{STATUS_META[normalizeStatus(v)].label}</option>)}</select> : STATUS_META[normalizeStatus(row.status)].label}</td>
        <td className="p-2">{canEdit && !context ? <select className={control} aria-label={`Priority for ${row.title}`} value={row.priority} disabled={pending} onChange={(e) => edit(row, "priority", e.target.value)}>{ISSUE_ENUMS.priority.map((v) => <option key={v}>{v}</option>)}</select> : PRIORITY_META[normalizePriority(row.priority)].label}</td>
        <td className="p-2">{canAssign && !context ? <select className={control} aria-label={`Assignee for ${row.title}`} value={row.assigneeId || ""} disabled={pending} onChange={(e) => edit(row, "assigneeId", e.target.value)}><option value="">Unassigned</option>{row.assigneeId && !users.some((u) => u.id === row.assigneeId) && <option value={row.assigneeId}>{row.assigneeName || "Current assignee"}</option>}{users.map((u) => <option key={u.id} value={u.id}>{u.name || "Unnamed"}</option>)}</select> : row.assigneeName || "Unassigned"}</td>
        <td className="whitespace-nowrap p-2 text-xs">{formatDate(row.dueDate)}</td><td className="whitespace-nowrap p-2 text-xs">{formatDate(row.updatedAt)}</td>
      </tr>
      {rowErrors[row.id] && <tr><td colSpan={9} role="alert" className="p-2 text-xs text-danger">{rowErrors[row.id]}</td></tr>}
    </Fragment>;
  }

  return <div className="space-y-3" aria-busy={pending}>
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-3">
      <form className="flex min-w-0 gap-1" onSubmit={(e) => { e.preventDefault(); navigate({ q: query }); }}>
        <Input aria-label="Search issue titles and keys" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search titles or keys" />
        <Button type="submit" disabled={pending}>Search</Button>
      </form>
      <select className={control} aria-label="Filter status" value={state.status} disabled={pending} onChange={(e) => navigate({ status: e.target.value })}>{["ALL", "ACTIVE", ...ISSUE_ENUMS.status].map((v) => <option key={v} value={v}>Status: {v}</option>)}</select>
      <select className={control} aria-label="Filter type" value={state.type} disabled={pending} onChange={(e) => navigate({ type: e.target.value })}>{["ALL", ...ISSUE_ENUMS.type].map((v) => <option key={v} value={v}>Type: {v}</option>)}</select>
      <select className={control} aria-label="Filter assignee" value={state.assignee} disabled={pending} onChange={(e) => navigate({ assignee: e.target.value })}><option value="ALL">Anyone</option><option value="UNASSIGNED">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name || "Unnamed"}</option>)}{!["ALL", "UNASSIGNED", ...users.map((u) => u.id)].includes(state.assignee) && <option value={state.assignee}>Selected assignee</option>}</select>
      <Button disabled={pending} onClick={() => navigate({ q: "", status: page.scope === "all" ? "ACTIVE" : "ALL", type: "ALL", assignee: "ALL", sort: "updatedAt", direction: "desc" })}>Clear filters</Button>
      <p className="text-xs text-muted-foreground">{page.matchingCount} matching issues in {page.groupCount} parent groups</p>
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
    {selected.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
      <span className="text-xs">{selected.length} selected</span>
      {(["status", "type", "priority"] as const).map((field) => <select key={field} aria-label={`Bulk ${field}`} className={control} value={bulk[field] || ""} onChange={(e) => setBulk((prev) => ({ ...prev, [field]: e.target.value }))} disabled={pending}><option value="">Keep {field}</option>{ISSUE_ENUMS[field].map((v) => <option key={v}>{v}</option>)}</select>)}
      {canAssign && <select aria-label="Bulk assignee" className={control} value={bulk.assigneeId || ""} onChange={(e) => setBulk((prev) => ({ ...prev, assigneeId: e.target.value }))} disabled={pending}><option value="">Keep assignee</option><option value="none">Unassign</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name || "Unnamed"}</option>)}</select>}
      <Button disabled={pending || selected.length > 100 || !Object.values(bulk).some(Boolean)} onClick={applyBulk}>Apply to selected</Button>
      <Button disabled={pending} onClick={() => setSelected([])}>Clear selection</Button>
      {selected.length > 100 && <p role="alert" className="text-xs text-danger">Select at most 100 issues per update.</p>}
    </div>}
    {pending && <p role="status" className="text-xs text-muted-foreground">Loading current issue data...</p>}
    {message && <p role={failure ? "alert" : "status"} className={`text-sm ${failure ? "text-danger" : "text-muted-foreground"}`}>{message}</p>}
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full text-left text-sm"><thead><tr>
        <th className="p-2">{canEdit && <input type="checkbox" aria-label="Select visible matching issues" checked={allSelected} disabled={pending} onChange={(e) => setSelected(e.target.checked ? visible.map((row) => row.id) : [])} />}</th>
        {(["id", "type", "title", "status", "priority", "assignee", "dueDate", "updatedAt"] as const).map((field) => <th key={field} className="p-2 text-xs" aria-sort={state.sort === field ? state.direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" className="whitespace-nowrap focus-ring" disabled={pending} onClick={() => navigate({ sort: field, direction: state.sort === field && state.direction === "desc" ? "asc" : "desc" })}>{({ id: "Key", type: "Type", title: "Title", status: "Status", priority: "Priority", assignee: "Assignee", dueDate: "Due", updatedAt: "Updated" })[field]}{state.sort === field ? state.direction === "asc" ? " ↑" : " ↓" : ""}</button></th>)}
      </tr></thead><tbody>
        {!groups.length && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No issues match these filters.</td></tr>}
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
