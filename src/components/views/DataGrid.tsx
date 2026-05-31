"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
    ArrowDown,
    ArrowUp,
    Filter,
    Loader2,
    Search,
    X,
} from "lucide-react";
import { updateIssueAssignee, updateIssueWorkflow } from "@/app/actions";
import { deleteSavedView, saveSavedView, type SavedViewFilters } from "@/app/staff-actions";
import { formatIssueRef } from "@/lib/issue-ids";
import {
    PRIORITY_META,
    PRIORITY_OPTIONS,
    SEVERITY_META,
    SEVERITY_OPTIONS,
    STATUS_META,
    STATUS_OPTIONS,
    TYPE_META,
    TYPE_OPTIONS,
    type IssuePriority,
    type IssueSeverity,
    type IssueStatus,
    type IssueType,
    normalizePriority,
    normalizeSeverity,
    normalizeStatus,
    normalizeType,
} from "@/lib/issue-tokens";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/components/ui/cn";

// ---- Backwards-compat re-exports for any page still importing these ----
export type { IssueStatus, IssuePriority, IssueType, IssueSeverity } from "@/lib/issue-tokens";

export const statusStyles: Record<IssueStatus, string> = {
    BACKLOG: "bg-muted text-muted-foreground border-border",
    OPEN: "bg-info/12 text-info border-info/30",
    IN_PROGRESS: "bg-warning/12 text-warning border-warning/30",
    REVIEW: "bg-primary/12 text-primary border-primary/30",
    DONE: "bg-success/12 text-success border-success/30",
};

export const typeStyles: Record<IssueType, string> = {
    BUG: "bg-danger/12 text-danger border-danger/30",
    FEATURE: "bg-info/12 text-info border-info/30",
    TASK: "bg-muted text-muted-foreground border-border",
};

export const priorityLabels: Record<IssuePriority, string> = {
    URGENT: "P0 · Urgent",
    HIGH: "P1 · High",
    MEDIUM: "P2 · Medium",
    LOW: "P3 · Low",
};

export const StatusIcon = ({ status }: { status: IssueStatus }) => (
    <>{STATUS_META[status].icon}</>
);
export const PriorityIcon = ({ priority }: { priority: IssuePriority }) => (
    <>{PRIORITY_META[priority].icon}</>
);
export const TypeIcon = ({ type }: { type: IssueType }) => (
    <>{TYPE_META[type].icon}</>
);

// ---- Snippet shape ----

export interface UserSnippet {
    id: string;
    name: string | null;
    image: string | null;
}

export interface IssueSnippet {
    id: string;
    publicKey?: string | null;
    title: string;
    status: IssueStatus;
    priority: IssuePriority;
    type: IssueType;
    assignee: UserSnippet | null;
    updatedAt: Date;
    severity?: IssueSeverity;
    environment?: string | null;
    tags?: string | null;
    dueDate?: Date | null;
    resourceName?: string | null;
    storyPoints?: number | null;
    parentIssueRef?: string | null;
    subtaskCount?: number;
}

interface DataGridProps {
    issues: IssueSnippet[];
    hideFilters?: boolean;
    /** When provided, the assignee column becomes an inline dropdown. */
    assignableUsers?: UserSnippet[];
    savedViews?: Array<{ id: string; name: string; filters: SavedViewFilters }>;
}

const EMPTY_SAVED_VIEWS: Array<{ id: string; name: string; filters: SavedViewFilters }> = [];

export function DataGrid({
    issues,
    hideFilters = false,
    assignableUsers,
    savedViews = EMPTY_SAVED_VIEWS,
}: DataGridProps) {
    const [localIssues, setLocalIssues] = useState(issues);
    const [localSavedViews, setLocalSavedViews] = useState(savedViews);
    const [viewName, setViewName] = useState("");
    const [sortConfig, setSortConfig] = useState<{
        key: keyof IssueSnippet;
        direction: "asc" | "desc";
    } | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [typeFilter, setTypeFilter] = useState<string>("ALL");
    const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");
    const [search, setSearch] = useState("");
    const [pendingIssueId, setPendingIssueId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        setLocalIssues(issues);
    }, [issues]);

    useEffect(() => {
        setLocalSavedViews(savedViews);
    }, [savedViews]);

    const applySavedView = (filters: SavedViewFilters) => {
        setStatusFilter(filters.status || "ALL");
        setTypeFilter(filters.type || "ALL");
        setAssigneeFilter(filters.assignee || "ALL");
        setSearch(filters.search || "");
    };

    const handleSaveView = () => {
        const name = viewName.trim();
        if (!name) return;
        startTransition(async () => {
            await saveSavedView(name, {
                status: statusFilter,
                type: typeFilter,
                assignee: assigneeFilter,
                search,
            });
            setViewName("");
            setLocalSavedViews((prev) => [
                ...prev,
                {
                    id: `temp-${Date.now()}`,
                    name,
                    filters: {
                        status: statusFilter,
                        type: typeFilter,
                        assignee: assigneeFilter,
                        search,
                    },
                },
            ]);
        });
    };

    const handleDeleteView = (id: string) => {
        startTransition(async () => {
            await deleteSavedView(id);
            setLocalSavedViews((prev) => prev.filter((v) => v.id !== id));
        });
    };

    const assigneeOptions = useMemo(
        () => [
            { value: "none", label: "Unassigned" },
            ...(assignableUsers ?? []).map((user) => ({
                value: user.id,
                label: user.name || "Unnamed",
                icon: (
                    <Avatar src={user.image} name={user.name} size="xs" />
                ),
            })),
        ],
        [assignableUsers]
    );

    const canEditAssignee = !!assignableUsers;

    const assignees = useMemo(() => {
        const unique = new Map<string, UserSnippet>();
        localIssues.forEach((i) => {
            if (i.assignee) unique.set(i.assignee.id, i.assignee);
        });
        return Array.from(unique.values());
    }, [localIssues]);

    const handleSort = (key: keyof IssueSnippet) => {
        let direction: "asc" | "desc" = "desc";
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "desc") {
            direction = "asc";
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: keyof IssueSnippet) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === "asc" ? (
            <ArrowUp className="w-3 h-3 inline ml-1 text-primary" />
        ) : (
            <ArrowDown className="w-3 h-3 inline ml-1 text-primary" />
        );
    };

    const sortedAndFilteredIssues = useMemo(() => {
        let filtered = localIssues;

        if (statusFilter !== "ALL") filtered = filtered.filter((i) => i.status === statusFilter);
        if (typeFilter !== "ALL") filtered = filtered.filter((i) => i.type === typeFilter);
        if (assigneeFilter !== "ALL") {
            if (assigneeFilter === "UNASSIGNED") filtered = filtered.filter((i) => !i.assignee);
            else filtered = filtered.filter((i) => i.assignee?.id === assigneeFilter);
        }
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            filtered = filtered.filter(
                (i) =>
                    i.title.toLowerCase().includes(q) ||
                    formatIssueRef(i.publicKey, i.id).toLowerCase().includes(q)
            );
        }

        if (!sortConfig) return filtered;

        const priorityOrder: Record<IssuePriority, number> = {
            LOW: 1,
            MEDIUM: 2,
            HIGH: 3,
            URGENT: 4,
        };

        return [...filtered].sort((a, b) => {
            if (sortConfig.key === "priority") {
                const aVal = priorityOrder[a.priority] || 0;
                const bVal = priorityOrder[b.priority] || 0;
                return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
            }
            if (sortConfig.key === "updatedAt") {
                const aTime = new Date(a.updatedAt).getTime();
                const bTime = new Date(b.updatedAt).getTime();
                return sortConfig.direction === "asc" ? aTime - bTime : bTime - aTime;
            }
            if (sortConfig.key === "dueDate") {
                const aTime = a.dueDate ? new Date(a.dueDate).getTime() : 0;
                const bTime = b.dueDate ? new Date(b.dueDate).getTime() : 0;
                return sortConfig.direction === "asc" ? aTime - bTime : bTime - aTime;
            }
            if (sortConfig.key === "assignee") {
                const aName = a.assignee?.name || "";
                const bName = b.assignee?.name || "";
                return sortConfig.direction === "asc"
                    ? aName.localeCompare(bName)
                    : bName.localeCompare(aName);
            }

            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];

            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
        });
    }, [localIssues, sortConfig, statusFilter, typeFilter, assigneeFilter, search]);

    const runWorkflowUpdate = (
        issueId: string,
        updates: Partial<{
            type: IssueType;
            priority: IssuePriority;
            severity: IssueSeverity;
            status: IssueStatus;
        }>
    ) => {
        const previous = localIssues;

        setLocalIssues((prev) =>
            prev.map((issue) => (issue.id !== issueId ? issue : { ...issue, ...updates }))
        );
        setPendingIssueId(issueId);

        startTransition(async () => {
            try {
                const result = await updateIssueWorkflow(issueId, updates);
                if (result?.error) setLocalIssues(previous);
            } catch {
                setLocalIssues(previous);
            } finally {
                setPendingIssueId(null);
            }
        });
    };

    const runAssigneeUpdate = (issueId: string, assigneeId: string | null) => {
        const previous = localIssues;
        const nextAssignee = assigneeId
            ? assignableUsers?.find((user) => user.id === assigneeId) ??
              localIssues.find((issue) => issue.id === issueId)?.assignee ??
              null
            : null;

        setLocalIssues((prev) =>
            prev.map((issue) =>
                issue.id !== issueId ? issue : { ...issue, assignee: nextAssignee }
            )
        );
        setPendingIssueId(issueId);

        startTransition(async () => {
            try {
                const result = await updateIssueAssignee(issueId, assigneeId);
                if (result?.error) setLocalIssues(previous);
            } catch {
                setLocalIssues(previous);
            } finally {
                setPendingIssueId(null);
            }
        });
    };

    const hasActiveFilters =
        statusFilter !== "ALL" ||
        typeFilter !== "ALL" ||
        assigneeFilter !== "ALL" ||
        search.trim() !== "";

    return (
        <div className="flex flex-col gap-3">
            {!hideFilters && (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-2">
                    <div className="flex items-center gap-1.5 px-1.5 text-[11px] uppercase tracking-wider text-subtle-foreground">
                        <Filter className="h-3 w-3" />
                        Filter
                    </div>

                    <div className="relative flex-1 min-w-[160px] max-w-xs">
                        <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-subtle-foreground" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search…"
                            className="h-7 w-full rounded-md border border-input bg-elevated pl-7 pr-2 text-xs focus-ring transition-colors hover:border-border-strong"
                        />
                    </div>

                    <Select
                        size="xs"
                        value={statusFilter}
                        onChange={setStatusFilter}
                        options={[
                            { value: "ALL", label: "Status · All" },
                            ...STATUS_OPTIONS,
                        ]}
                        className="w-auto min-w-[120px]"
                        fullWidth={false}
                    />
                    <Select
                        size="xs"
                        value={typeFilter}
                        onChange={setTypeFilter}
                        options={[
                            { value: "ALL", label: "Type · All" },
                            ...TYPE_OPTIONS,
                        ]}
                        className="w-auto min-w-[120px]"
                        fullWidth={false}
                    />
                    <Select
                        size="xs"
                        value={assigneeFilter}
                        onChange={setAssigneeFilter}
                        options={[
                            { value: "ALL", label: "Assignee · Anyone" },
                            { value: "UNASSIGNED", label: "Unassigned" },
                            ...assignees.map((a) => ({
                                value: a.id,
                                label: a.name || "Unnamed",
                            })),
                        ]}
                        className="w-auto min-w-[150px]"
                        fullWidth={false}
                        maxVisibleItems={5}
                    />

                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={() => {
                                setStatusFilter("ALL");
                                setTypeFilter("ALL");
                                setAssigneeFilter("ALL");
                                setSearch("");
                            }}
                            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 h-7 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <X className="h-3 w-3" />
                            Clear
                        </button>
                    )}

                    <div className={cn("text-[11px] text-subtle-foreground", !hasActiveFilters && "ml-auto")}>
                        {sortedAndFilteredIssues.length} of {localIssues.length}
                    </div>

                    {localSavedViews.length > 0 && (
                        <div className="flex w-full flex-wrap items-center gap-1.5 border-t border-border pt-2">
                            <span className="text-[10px] uppercase tracking-wider text-subtle-foreground">
                                Saved views
                            </span>
                            {localSavedViews.map((view) => (
                                <div key={view.id} className="flex items-center gap-0.5">
                                    <button
                                        type="button"
                                        onClick={() => applySavedView(view.filters)}
                                        className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/80"
                                    >
                                        {view.name}
                                    </button>
                                    {!view.id.startsWith("temp-") && (
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteView(view.id)}
                                            className="rounded p-0.5 text-subtle-foreground hover:text-danger"
                                            title="Delete view"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {hasActiveFilters && (
                        <div className="flex w-full items-center gap-2 border-t border-border pt-2">
                            <input
                                value={viewName}
                                onChange={(e) => setViewName(e.target.value)}
                                placeholder="Save current filters as…"
                                className="h-7 flex-1 rounded-md border border-input bg-elevated px-2 text-xs focus-ring"
                            />
                            <button
                                type="button"
                                onClick={handleSaveView}
                                disabled={!viewName.trim() || isPending}
                                className="rounded-md border border-border px-2 h-7 text-xs hover:bg-muted disabled:opacity-50"
                            >
                                Save view
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="overflow-hidden rounded-md border border-border bg-surface">
                <div className="overflow-x-auto">
                    <table className="w-full whitespace-nowrap text-left text-sm">
                        <thead>
                            <tr className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-wider text-subtle-foreground">
                                <th
                                    onClick={() => handleSort("id")}
                                    className="w-16 px-3 py-2 font-medium cursor-pointer hover:text-foreground"
                                >
                                    ID {getSortIndicator("id")}
                                </th>
                                <th
                                    onClick={() => handleSort("type")}
                                    className="w-28 px-2 py-2 font-medium cursor-pointer hover:text-foreground"
                                >
                                    Type {getSortIndicator("type")}
                                </th>
                                <th
                                    onClick={() => handleSort("title")}
                                    className="px-3 py-2 font-medium cursor-pointer hover:text-foreground"
                                >
                                    Title {getSortIndicator("title")}
                                </th>
                                <th
                                    onClick={() => handleSort("status")}
                                    className="w-32 px-2 py-2 font-medium cursor-pointer hover:text-foreground"
                                >
                                    Status {getSortIndicator("status")}
                                </th>
                                <th
                                    onClick={() => handleSort("priority")}
                                    className="w-24 px-2 py-2 font-medium cursor-pointer hover:text-foreground"
                                >
                                    Priority {getSortIndicator("priority")}
                                </th>
                                <th className="w-28 px-2 py-2 font-medium">Severity</th>
                                <th
                                    onClick={() => handleSort("assignee")}
                                    className="w-36 px-3 py-2 font-medium cursor-pointer hover:text-foreground"
                                >
                                    Assignee {getSortIndicator("assignee")}
                                </th>
                                <th
                                    onClick={() => handleSort("dueDate")}
                                    className="w-24 px-3 py-2 font-medium cursor-pointer hover:text-foreground"
                                >
                                    Due {getSortIndicator("dueDate")}
                                </th>
                                <th
                                    onClick={() => handleSort("updatedAt")}
                                    className="w-28 px-3 py-2 font-medium cursor-pointer hover:text-foreground text-right"
                                >
                                    Updated {getSortIndicator("updatedAt")}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedAndFilteredIssues.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={9}
                                        className="px-4 py-12 text-center text-xs text-muted-foreground"
                                    >
                                        No issues found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                sortedAndFilteredIssues.map((issue) => {
                                    const issueRef = formatIssueRef(issue.publicKey, issue.id);
                                    const updating = isPending && pendingIssueId === issue.id;
                                    return (
                                        <tr
                                            key={issue.id}
                                            className="group border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors"
                                        >
                                            <td className="px-3 py-1.5">
                                                <Link
                                                    href={`/issues/${issueRef}`}
                                                    className="font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors"
                                                >
                                                    {issueRef}
                                                </Link>
                                            </td>
                                            <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                                                <Select
                                                    size="xs"
                                                    value={normalizeType(issue.type)}
                                                    options={TYPE_OPTIONS}
                                                    onChange={(v) =>
                                                        runWorkflowUpdate(issue.id, {
                                                            type: v as IssueType,
                                                        })
                                                    }
                                                    disabled={updating}
                                                />
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <Link
                                                    href={`/issues/${issueRef}`}
                                                    className="block truncate max-w-[520px] text-sm font-medium text-foreground transition-colors group-hover:text-primary"
                                                >
                                                    {issue.parentIssueRef && (
                                                        <span className="mr-1.5 text-[10px] font-mono text-subtle-foreground">
                                                            ↳ {issue.parentIssueRef}
                                                        </span>
                                                    )}
                                                    {issue.title}
                                                    {!!issue.subtaskCount && issue.subtaskCount > 0 && (
                                                        <span className="ml-2 inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground align-middle">
                                                            {issue.subtaskCount} subtask
                                                            {issue.subtaskCount === 1 ? "" : "s"}
                                                        </span>
                                                    )}
                                                </Link>
                                            </td>
                                            <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                                                <Select
                                                    size="xs"
                                                    value={normalizeStatus(issue.status)}
                                                    options={STATUS_OPTIONS}
                                                    onChange={(v) =>
                                                        runWorkflowUpdate(issue.id, {
                                                            status: v as IssueStatus,
                                                        })
                                                    }
                                                    disabled={updating}
                                                />
                                            </td>
                                            <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                                                <Select
                                                    size="xs"
                                                    value={normalizePriority(issue.priority)}
                                                    options={PRIORITY_OPTIONS}
                                                    onChange={(v) =>
                                                        runWorkflowUpdate(issue.id, {
                                                            priority: v as IssuePriority,
                                                        })
                                                    }
                                                    disabled={updating}
                                                />
                                            </td>
                                            <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                                                <Select
                                                    size="xs"
                                                    value={normalizeSeverity(issue.severity ?? "MINOR")}
                                                    options={SEVERITY_OPTIONS}
                                                    onChange={(v) =>
                                                        runWorkflowUpdate(issue.id, {
                                                            severity: v as IssueSeverity,
                                                        })
                                                    }
                                                    disabled={updating}
                                                />
                                            </td>
                                            <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                                                {canEditAssignee ? (
                                                    <Select
                                                        size="xs"
                                                        value={issue.assignee?.id ?? "none"}
                                                        options={assigneeOptions}
                                                        onChange={(value) =>
                                                            runAssigneeUpdate(
                                                                issue.id,
                                                                value === "none" ? null : value
                                                            )
                                                        }
                                                        disabled={updating}
                                                        maxVisibleItems={3}
                                                        className="min-w-[140px]"
                                                    />
                                                ) : issue.assignee ? (
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Avatar
                                                            src={issue.assignee.image}
                                                            name={issue.assignee.name}
                                                            size="xs"
                                                        />
                                                        <span className="truncate text-xs text-foreground">
                                                            {issue.assignee.name}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-subtle-foreground">
                                                        Unassigned
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-1.5 text-xs text-muted-foreground">
                                                {issue.dueDate
                                                    ? new Intl.DateTimeFormat("en-US", {
                                                          month: "short",
                                                          day: "numeric",
                                                      }).format(new Date(issue.dueDate))
                                                    : "—"}
                                            </td>
                                            <td className="px-3 py-1.5 text-right text-xs font-mono text-muted-foreground">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {updating && (
                                                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                                    )}
                                                    {new Intl.DateTimeFormat("en-US", {
                                                        month: "short",
                                                        day: "numeric",
                                                    }).format(new Date(issue.updatedAt))}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ---- Inline badges used elsewhere (issue detail page, kanban) ----

export function StatusBadge({ status }: { status: IssueStatus }) {
    const meta = STATUS_META[status];
    return (
        <Badge tone={meta.tone}>
            {meta.icon} {meta.label}
        </Badge>
    );
}
export function PriorityBadge({ priority }: { priority: IssuePriority }) {
    const meta = PRIORITY_META[priority];
    return (
        <Badge tone={meta.tone}>
            {meta.icon} {meta.label}
        </Badge>
    );
}
export function TypeBadge({ type }: { type: IssueType }) {
    const meta = TYPE_META[type];
    return (
        <Badge tone={meta.tone}>
            {meta.icon} {meta.label}
        </Badge>
    );
}
export function SeverityBadge({ severity }: { severity: IssueSeverity }) {
    const meta = SEVERITY_META[severity];
    return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
