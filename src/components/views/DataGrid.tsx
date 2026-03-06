"use client"

import { useState } from "react"
import Link from "next/link"
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    Bug as BugIcon,
    CheckCircle2,
    CircleDashed,
    MoreHorizontal,
    Lightbulb,
    KanbanSquare
} from "lucide-react"
import clsx from "clsx"

// Dummy types based on Prisma schema
export type IssueStatus = "OPEN" | "IN_PROGRESS" | "REVIEW" | "DONE"
export type IssuePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT"
export type IssueType = "BUG" | "FEATURE" | "TASK"

export interface UserSnippet {
    id: string
    name: string | null
    image: string | null
}

export interface IssueSnippet {
    id: string
    title: string
    status: IssueStatus
    priority: IssuePriority
    type: IssueType
    assignee: UserSnippet | null
    updatedAt: Date
    severity?: string
    environment?: string | null
    tags?: string | null
    dueDate?: Date | null
    resourceName?: string | null
    storyPoints?: number | null
}

export const statusStyles: Record<IssueStatus, string> = {
    OPEN: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
    IN_PROGRESS: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    REVIEW: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
    DONE: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
}

export const typeStyles: Record<IssueType, string> = {
    BUG: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
    FEATURE: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    TASK: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
}

const priorityStyles: Record<IssuePriority, string> = {
    LOW: "text-slate-500",
    MEDIUM: "text-amber-500",
    HIGH: "text-orange-500",
    URGENT: "text-red-500",
}

export const StatusIcon = ({ status }: { status: IssueStatus }) => {
    switch (status) {
        case "OPEN": return <CircleDashed className="h-4 w-4 text-sky-500" />
        case "IN_PROGRESS": return <KanbanSquare className="h-4 w-4 text-amber-500" />
        case "REVIEW": return <AlertCircle className="h-4 w-4 text-violet-500" />
        case "DONE": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    }
}

export const PriorityIcon = ({ priority }: { priority: IssuePriority }) => {
    switch (priority) {
        case "LOW": return <ArrowDown className={clsx("h-4 w-4", priorityStyles.LOW)} />
        case "MEDIUM": return <MoreHorizontal className={clsx("h-4 w-4", priorityStyles.MEDIUM)} />
        case "HIGH": return <ArrowUp className={clsx("h-4 w-4", priorityStyles.HIGH)} />
        case "URGENT": return <AlertCircle className={clsx("h-4 w-4", priorityStyles.URGENT)} />
    }
}

export const TypeIcon = ({ type }: { type: IssueType }) => {
    switch (type) {
        case "BUG": return <BugIcon className="h-4 w-4 text-red-500" />
        case "FEATURE": return <Lightbulb className="h-4 w-4 text-blue-500" />
        case "TASK": return <CheckCircle2 className="h-4 w-4 text-slate-500" />
    }
}

import { useMemo } from "react"

interface DataGridProps {
    issues: IssueSnippet[]
    hideFilters?: boolean
}

export function DataGrid({ issues, hideFilters = false }: DataGridProps) {
    const [sortConfig, setSortConfig] = useState<{ key: keyof IssueSnippet, direction: "asc" | "desc" } | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [typeFilter, setTypeFilter] = useState<string>("ALL");
    const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");

    const assignees = useMemo(() => {
        const unique = new Map();
        issues.forEach(i => {
            if (i.assignee) unique.set(i.assignee.id, i.assignee);
        });
        return Array.from(unique.values());
    }, [issues]);

    const handleSort = (key: keyof IssueSnippet) => {
        let direction: "asc" | "desc" = "desc";
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "desc") {
            direction = "asc";
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: keyof IssueSnippet) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === "asc" ? <ArrowUp className="w-3 h-3 inline ml-1 text-primary" /> : <ArrowDown className="w-3 h-3 inline ml-1 text-primary" />;
    };

    const sortedAndFilteredIssues = useMemo(() => {
        let filtered = issues;

        if (statusFilter !== "ALL") {
            filtered = filtered.filter(i => i.status === statusFilter);
        }
        if (typeFilter !== "ALL") {
            filtered = filtered.filter(i => i.type === typeFilter);
        }
        if (assigneeFilter !== "ALL") {
            if (assigneeFilter === "UNASSIGNED") {
                filtered = filtered.filter(i => !i.assignee);
            } else {
                filtered = filtered.filter(i => i.assignee?.id === assigneeFilter);
            }
        }

        if (!sortConfig) return filtered;

        const priorityOrder: Record<IssuePriority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 };

        return [...filtered].sort((a, b) => {
            if (sortConfig.key === 'priority') {
                const aVal = priorityOrder[a.priority as IssuePriority] || 0;
                const bVal = priorityOrder[b.priority as IssuePriority] || 0;
                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
            }
            if (sortConfig.key === 'updatedAt') {
                const aTime = new Date(a.updatedAt).getTime();
                const bTime = new Date(b.updatedAt).getTime();
                return sortConfig.direction === 'asc' ? aTime - bTime : bTime - aTime;
            }
            if (sortConfig.key === 'dueDate') {
                const aTime = a.dueDate ? new Date(a.dueDate).getTime() : 0;
                const bTime = b.dueDate ? new Date(b.dueDate).getTime() : 0;
                return sortConfig.direction === 'asc' ? aTime - bTime : bTime - aTime;
            }
            if (sortConfig.key === 'assignee') {
                const aName = a.assignee?.name || "";
                const bName = b.assignee?.name || "";
                return sortConfig.direction === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName);
            }

            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];

            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [issues, sortConfig, statusFilter, typeFilter, assigneeFilter]);

    return (
        <div className="flex flex-col gap-4">
            {!hideFilters && (
                <div className="flex flex-wrap items-center gap-3 bg-background p-4 rounded-xl border border-border shadow-sm">
                    <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Filters</div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="text-xs bg-background text-foreground px-3 py-2 rounded-lg border border-border transition-colors outline-none focus:ring-2 focus:ring-primary/30 appearance-none hover:bg-muted/50"
                    >
                        <option value="ALL">Status: All</option>
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="REVIEW">Review</option>
                        <option value="DONE">Done</option>
                    </select>
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="text-xs bg-background text-foreground px-3 py-2 rounded-lg border border-border transition-colors outline-none focus:ring-2 focus:ring-primary/30 appearance-none hover:bg-muted/50"
                    >
                        <option value="ALL">Type: All</option>
                        <option value="BUG">Bug</option>
                        <option value="FEATURE">Feature</option>
                        <option value="TASK">Task</option>
                    </select>
                    <select
                        value={assigneeFilter}
                        onChange={(e) => setAssigneeFilter(e.target.value)}
                        className="text-xs bg-background text-foreground px-3 py-2 rounded-lg border border-border transition-colors outline-none focus:ring-2 focus:ring-primary/30 appearance-none hover:bg-muted/50"
                    >
                        <option value="ALL">Assignee: Anyone</option>
                        <option value="UNASSIGNED">Unassigned</option>
                        {assignees.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </div>
            )}

            <div className="w-full bg-background rounded-md border shadow-sm overflow-hidden text-sm">
                <div className="overflow-x-auto">
                    <table className="w-full whitespace-nowrap text-left border-collapse">
                        <thead>
                            <tr className="border-b bg-muted/50 text-muted-foreground font-medium text-xs tracking-wider select-none">
                                <th onClick={() => handleSort('id')} className="px-4 py-2 font-medium w-12 text-center cursor-pointer hover:text-foreground">
                                    ID {getSortIndicator('id')}
                                </th>
                                <th onClick={() => handleSort('type')} className="px-4 py-2 font-medium w-32 cursor-pointer hover:text-foreground">
                                    Type {getSortIndicator('type')}
                                </th>
                                <th onClick={() => handleSort('title')} className="px-4 py-2 font-medium cursor-pointer hover:text-foreground">
                                    Title {getSortIndicator('title')}
                                </th>
                                <th onClick={() => handleSort('status')} className="px-4 py-2 font-medium w-32 cursor-pointer hover:text-foreground">
                                    Status {getSortIndicator('status')}
                                </th>
                                <th onClick={() => handleSort('priority')} className="px-4 py-2 font-medium w-24 cursor-pointer hover:text-foreground">
                                    Priority {getSortIndicator('priority')}
                                </th>
                                <th onClick={() => handleSort('assignee')} className="px-4 py-2 font-medium w-40 cursor-pointer hover:text-foreground">
                                    Assignee {getSortIndicator('assignee')}
                                </th>
                                <th onClick={() => handleSort('dueDate')} className="px-4 py-2 font-medium w-28 cursor-pointer hover:text-foreground">
                                    Due {getSortIndicator('dueDate')}
                                </th>
                                <th onClick={() => handleSort('updatedAt')} className="px-4 py-2 font-medium w-32 text-right cursor-pointer hover:text-foreground">
                                    Updated {getSortIndicator('updatedAt')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {sortedAndFilteredIssues.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                                        No issues found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                sortedAndFilteredIssues.map((issue) => (
                                    <tr
                                        key={issue.id}
                                        className="hover:bg-muted/30 transition-colors group cursor-pointer"
                                    >
                                        <td className="px-4 text-center">
                                            <Link href={`/issues/${issue.id}`} className="block py-2 text-muted-foreground hover:text-primary transition-colors font-mono">
                                                {issue.id.slice(-5)}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-1">
                                            <span className={clsx("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium", typeStyles[issue.type])}>
                                                <TypeIcon type={issue.type} />
                                                {issue.type.replace("_", " ")}
                                            </span>
                                        </td>
                                        <td className="px-4 py-1 font-medium text-foreground group-hover:text-primary">
                                            <Link href={`/issues/${issue.id}`} className="block py-2 truncate max-w-[500px]">
                                                {issue.title}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-1">
                                            <span className={clsx("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium", statusStyles[issue.status])}>
                                                <StatusIcon status={issue.status} />
                                                {issue.status.replace("_", " ")}
                                            </span>
                                        </td>
                                        <td className="px-4 py-1">
                                            <div className="flex items-center gap-1">
                                                <PriorityIcon priority={issue.priority} />
                                            </div>
                                        </td>
                                        <td className="px-4 py-1">
                                            {issue.assignee ? (
                                                <div className="flex items-center gap-2">
                                                    {issue.assignee.image ? (
                                                        <img
                                                            src={issue.assignee.image}
                                                            alt={issue.assignee.name || "Assignee"}
                                                            className="w-6 h-6 rounded-full border border-border object-cover shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full border border-border bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                                            {issue.assignee.name?.charAt(0).toUpperCase() || "A"}
                                                        </div>
                                                    )}
                                                    <span className="text-xs truncate w-24">{issue.assignee.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-1 text-muted-foreground text-xs">
                                            {issue.dueDate
                                                ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(issue.dueDate))
                                                : "—"}
                                        </td>
                                        <td className="px-4 py-1 text-right text-muted-foreground text-xs font-mono">
                                            {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(issue.updatedAt))}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
