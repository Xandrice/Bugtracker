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
import { updateIssueWorkflow } from "@/app/actions";
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
import {
    Table,
    Dropdown,
    DropdownTrigger,
    DropdownPopover,
    DropdownMenu,
    DropdownItem,
    Button,
    Chip,
    Avatar,
    Input,
    buttonVariants,
    cn,
} from "@heroui/react";

// ---- Backwards-compat re-exports for any page still importing these ----
export type { IssueStatus, IssuePriority, IssueType, IssueSeverity } from "@/lib/issue-tokens";

const toneToColor = (tone: string): "default" | "accent" | "success" | "warning" | "danger" => {
    switch (tone) {
        case "neutral": return "default";
        case "info": return "accent";
        case "warning": return "warning";
        case "primary": return "accent";
        case "success": return "success";
        case "danger": return "danger";
        default: return "default";
    }
};

export function StatusBadge({ status }: { status: IssueStatus }) {
    const meta = STATUS_META[status];
    return (
        <Chip
            size="sm"
            variant="soft"
            color={toneToColor(meta.tone)}
            className="inline-flex items-center gap-1 border border-default-250/20 px-1.5 h-6 text-[11px] font-medium"
        >
            {meta.icon}
            {meta.label}
        </Chip>
    );
}

export function PriorityBadge({ priority }: { priority: IssuePriority }) {
    const meta = PRIORITY_META[priority];
    return (
        <Chip
            size="sm"
            variant="soft"
            color={toneToColor(meta.tone)}
            className="inline-flex items-center gap-1 border border-default-250/20 px-1.5 h-6 text-[11px] font-medium"
        >
            {meta.icon}
            {meta.label}
        </Chip>
    );
}

export function TypeBadge({ type }: { type: IssueType }) {
    const meta = TYPE_META[type];
    return (
        <Chip
            size="sm"
            variant="soft"
            color={toneToColor(meta.tone)}
            className="inline-flex items-center gap-1 border border-default-250/20 px-1.5 h-6 text-[11px] font-medium"
        >
            {meta.icon}
            {meta.label}
        </Chip>
    );
}

export function SeverityBadge({ severity }: { severity: IssueSeverity }) {
    const meta = SEVERITY_META[severity];
    return (
        <Chip
            size="sm"
            variant="soft"
            color={toneToColor(meta.tone)}
            className="inline-flex items-center border border-default-250/20 px-1.5 h-6 text-[11px] font-medium"
        >
            {meta.label}
        </Chip>
    );
}

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
}

export function DataGrid({ issues, hideFilters = false }: DataGridProps) {
    const [localIssues, setLocalIssues] = useState(issues);
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
            <ArrowUp className="w-3.5 h-3.5 inline ml-1 text-primary" />
        ) : (
            <ArrowDown className="w-3.5 h-3.5 inline ml-1 text-primary" />
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

    const hasActiveFilters =
        statusFilter !== "ALL" ||
        typeFilter !== "ALL" ||
        assigneeFilter !== "ALL" ||
        search.trim() !== "";

    return (
        <div className="flex flex-col gap-3">
            {!hideFilters && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-default-100 bg-background/50 backdrop-blur-md p-2.5 shadow-sm">
                    <div className="flex items-center gap-1.5 px-1.5 text-[11px] font-semibold uppercase tracking-wider text-default-400">
                        <Filter className="h-3.5 w-3.5" />
                        Filters
                    </div>

                    <div className="relative flex-1 min-w-[180px] max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-default-450 pointer-events-none" />
                        <Input
                            placeholder="Search issues..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 pr-8 py-1 w-full bg-default-50/50 border border-default-200/50 hover:border-default-400 focus:outline-none focus:border-primary text-xs rounded-lg transition-colors h-9"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-default-450 hover:text-foreground cursor-pointer"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Status Filter Dropdown */}
                    <Dropdown>
                        <DropdownTrigger
                            className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "h-9 rounded-lg border border-default-200/50 bg-default-50/50 text-xs font-semibold text-foreground/80 hover:text-foreground cursor-pointer focus:outline-none"
                            )}
                        >
                            Status: {statusFilter === "ALL" ? "All" : STATUS_META[statusFilter as IssueStatus].label}
                        </DropdownTrigger>
                        <DropdownPopover className="border border-default-100 bg-background/95 backdrop-blur-md shadow-lg" placement="bottom start">
                            <DropdownMenu 
                                aria-label="Filter Status" 
                                selectionMode="single" 
                                selectedKeys={new Set([statusFilter])}
                                onSelectionChange={(keys) => setStatusFilter(Array.from(keys)[0] as string)}
                            >
                                <DropdownItem key="ALL">All Statuses</DropdownItem>
                                {STATUS_OPTIONS.map((opt) => (
                                    <DropdownItem key={opt.value}>
                                        <span className="flex items-center gap-2">
                                            {opt.icon}
                                            {opt.label}
                                        </span>
                                    </DropdownItem>
                                ))}
                            </DropdownMenu>
                        </DropdownPopover>
                    </Dropdown>

                    {/* Type Filter Dropdown */}
                    <Dropdown>
                        <DropdownTrigger
                            className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "h-9 rounded-lg border border-default-200/50 bg-default-50/50 text-xs font-semibold text-foreground/80 hover:text-foreground cursor-pointer focus:outline-none"
                            )}
                        >
                            Type: {typeFilter === "ALL" ? "All" : TYPE_META[typeFilter as IssueType].label}
                        </DropdownTrigger>
                        <DropdownPopover className="border border-default-100 bg-background/95 backdrop-blur-md shadow-lg" placement="bottom start">
                            <DropdownMenu 
                                aria-label="Filter Type" 
                                selectionMode="single" 
                                selectedKeys={new Set([typeFilter])}
                                onSelectionChange={(keys) => setTypeFilter(Array.from(keys)[0] as string)}
                            >
                                <DropdownItem key="ALL">All Types</DropdownItem>
                                {TYPE_OPTIONS.map((opt) => (
                                    <DropdownItem key={opt.value}>
                                        <span className="flex items-center gap-2">
                                            {opt.icon}
                                            {opt.label}
                                        </span>
                                    </DropdownItem>
                                ))}
                            </DropdownMenu>
                        </DropdownPopover>
                    </Dropdown>

                    {/* Assignee Filter Dropdown */}
                    <Dropdown>
                        <DropdownTrigger
                            className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "h-9 rounded-lg border border-default-200/50 bg-default-50/50 text-xs font-semibold text-foreground/80 hover:text-foreground cursor-pointer focus:outline-none"
                            )}
                        >
                            Assignee: {
                                assigneeFilter === "ALL" 
                                    ? "Anyone" 
                                    : assigneeFilter === "UNASSIGNED" 
                                        ? "Unassigned" 
                                        : assignees.find(a => a.id === assigneeFilter)?.name || "User"
                            }
                        </DropdownTrigger>
                        <DropdownPopover className="border border-default-100 bg-background/95 backdrop-blur-md shadow-lg" placement="bottom start">
                            <DropdownMenu 
                                aria-label="Filter Assignee" 
                                selectionMode="single" 
                                selectedKeys={new Set([assigneeFilter])}
                                onSelectionChange={(keys) => setAssigneeFilter(Array.from(keys)[0] as string)}
                            >
                                <DropdownItem key="ALL">Anyone</DropdownItem>
                                <DropdownItem key="UNASSIGNED">Unassigned</DropdownItem>
                                {assignees.map((a) => (
                                    <DropdownItem key={a.id}>
                                        <span className="flex items-center gap-2">
                                            <Avatar className="h-5 w-5 text-[9px]">
                                                {a.image && <Avatar.Image src={a.image} className="object-cover h-full w-full" />}
                                                <Avatar.Fallback>{(a.name || "U").charAt(0).toUpperCase()}</Avatar.Fallback>
                                            </Avatar>
                                            {a.name || "Unnamed"}
                                        </span>
                                    </DropdownItem>
                                ))}
                            </DropdownMenu>
                        </DropdownPopover>
                    </Dropdown>

                    {hasActiveFilters && (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                setStatusFilter("ALL");
                                setTypeFilter("ALL");
                                setAssigneeFilter("ALL");
                                setSearch("");
                            }}
                            className="ml-auto text-xs text-default-500 hover:text-foreground h-9 px-3"
                        >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Clear
                        </Button>
                    )}

                    <div className={`text-[11px] font-semibold text-default-450 ${!hasActiveFilters ? "ml-auto" : ""}`}>
                        {sortedAndFilteredIssues.length} of {localIssues.length}
                    </div>
                </div>
            )}

            <div className="overflow-x-auto bg-background/40 backdrop-blur-md border border-default-100 shadow-none rounded-xl p-0">
                <Table className="w-full border-collapse text-left [&_th]:bg-default-50/50 [&_th]:text-default-500 [&_th]:font-semibold [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wider [&_th]:py-3 [&_th]:px-4 [&_th]:border-b [&_th]:border-default-100 [&_th]:hover:text-foreground [&_th]:transition-colors [&_th]:cursor-pointer [&_td]:py-3 [&_td]:px-4 [&_td]:border-b [&_td]:border-default-100/50 [&_tr]:last:[&_td]:border-b-0 [&_tr]:first:rounded-t-xl">
                    <Table.Content aria-label="Issues table">
                        <Table.Header>
                            <Table.Column onClick={() => handleSort("id")}>ID {getSortIndicator("id")}</Table.Column>
                            <Table.Column onClick={() => handleSort("type")}>Type {getSortIndicator("type")}</Table.Column>
                            <Table.Column onClick={() => handleSort("title")}>Title {getSortIndicator("title")}</Table.Column>
                            <Table.Column onClick={() => handleSort("status")}>Status {getSortIndicator("status")}</Table.Column>
                            <Table.Column onClick={() => handleSort("priority")}>Priority {getSortIndicator("priority")}</Table.Column>
                            <Table.Column>Severity</Table.Column>
                            <Table.Column onClick={() => handleSort("assignee")}>Assignee {getSortIndicator("assignee")}</Table.Column>
                            <Table.Column onClick={() => handleSort("dueDate")}>Due {getSortIndicator("dueDate")}</Table.Column>
                            <Table.Column onClick={() => handleSort("updatedAt")} className="text-right">Updated {getSortIndicator("updatedAt")}</Table.Column>
                        </Table.Header>
                        <Table.Body>
                            {sortedAndFilteredIssues.length === 0 ? (
                                <Table.Row>
                                    <Table.Cell colSpan={9} className="py-8 text-center text-xs text-default-450">
                                        No issues found matching your criteria.
                                    </Table.Cell>
                                </Table.Row>
                            ) : (
                                sortedAndFilteredIssues.map((issue) => {
                                    const issueRef = formatIssueRef(issue.publicKey, issue.id);
                                    const updating = isPending && pendingIssueId === issue.id;
                                    return (
                                        <Table.Row key={issue.id} id={issue.id} className="group hover:bg-default-50/40 transition-colors">
                                            {/* ID */}
                                            <Table.Cell>
                                                <Link
                                                    href={`/issues/${issueRef}`}
                                                    className="font-mono text-[11px] text-default-500 hover:text-primary transition-colors font-medium"
                                                >
                                                    {issueRef}
                                                </Link>
                                            </Table.Cell>

                                            {/* Type Selector (Inline Dropdown) */}
                                            <Table.Cell onClick={(e) => e.stopPropagation()}>
                                                <Dropdown>
                                                    <DropdownTrigger
                                                        className={cn(
                                                            buttonVariants({ variant: "outline", size: "sm" }),
                                                            "h-7 min-w-[85px] justify-between px-2 text-xs border border-default-200/50 hover:border-default-400 bg-background/50 rounded-lg cursor-pointer focus:outline-none"
                                                        )}
                                                        isDisabled={updating}
                                                    >
                                                        <span className="flex items-center gap-1.5">
                                                            {TYPE_META[issue.type].icon}
                                                            {TYPE_META[issue.type].label}
                                                        </span>
                                                    </DropdownTrigger>
                                                    <DropdownPopover className="border border-default-100 bg-background/95 backdrop-blur-md shadow-lg" placement="bottom start">
                                                        <DropdownMenu
                                                            aria-label="Select Type"
                                                            selectionMode="single"
                                                            selectedKeys={new Set([issue.type])}
                                                            onSelectionChange={(keys) => {
                                                                const nextVal = Array.from(keys)[0] as IssueType;
                                                                if (nextVal) {
                                                                    runWorkflowUpdate(issue.id, { type: nextVal });
                                                                }
                                                            }}
                                                        >
                                                            {TYPE_OPTIONS.map((opt) => (
                                                                <DropdownItem key={opt.value}>
                                                                    <span className="flex items-center gap-2">
                                                                        {opt.icon}
                                                                        {opt.label}
                                                                    </span>
                                                                </DropdownItem>
                                                            ))}
                                                        </DropdownMenu>
                                                    </DropdownPopover>
                                                </Dropdown>
                                            </Table.Cell>

                                            {/* Title */}
                                            <Table.Cell>
                                                <Link
                                                    href={`/issues/${issueRef}`}
                                                    className="block truncate max-w-[400px] text-sm font-semibold text-foreground transition-colors group-hover:text-primary"
                                                >
                                                    {issue.parentIssueRef && (
                                                        <span className="mr-1.5 text-[10px] font-mono text-default-450 font-normal">
                                                            ↳ {issue.parentIssueRef}
                                                        </span>
                                                    )}
                                                    {issue.title}
                                                    {!!issue.subtaskCount && issue.subtaskCount > 0 && (
                                                        <Chip
                                                            size="sm"
                                                            variant="soft"
                                                            color="default"
                                                            className="ml-2 h-5 text-[10px] font-semibold border border-default-200/30"
                                                        >
                                                            {issue.subtaskCount} subtask{issue.subtaskCount === 1 ? "" : "s"}
                                                        </Chip>
                                                    )}
                                                </Link>
                                            </Table.Cell>

                                            {/* Status Selector (Inline Dropdown) */}
                                            <Table.Cell onClick={(e) => e.stopPropagation()}>
                                                <Dropdown>
                                                    <DropdownTrigger
                                                        className={cn(
                                                            buttonVariants({ variant: "outline", size: "sm" }),
                                                            "h-7 min-w-[110px] justify-between px-2 text-xs border border-default-200/50 hover:border-default-400 bg-background/50 rounded-lg cursor-pointer focus:outline-none"
                                                        )}
                                                        isDisabled={updating}
                                                    >
                                                        <span className="flex items-center gap-1.5 font-medium">
                                                            {STATUS_META[issue.status].icon}
                                                            {STATUS_META[issue.status].label}
                                                        </span>
                                                    </DropdownTrigger>
                                                    <DropdownPopover className="border border-default-100 bg-background/95 backdrop-blur-md shadow-lg" placement="bottom start">
                                                        <DropdownMenu
                                                            aria-label="Select Status"
                                                            selectionMode="single"
                                                            selectedKeys={new Set([issue.status])}
                                                            onSelectionChange={(keys) => {
                                                                const nextVal = Array.from(keys)[0] as IssueStatus;
                                                                if (nextVal) {
                                                                    runWorkflowUpdate(issue.id, { status: nextVal });
                                                                }
                                                            }}
                                                        >
                                                            {STATUS_OPTIONS.map((opt) => (
                                                                <DropdownItem key={opt.value}>
                                                                    <span className="flex items-center gap-2">
                                                                        {opt.icon}
                                                                        {opt.label}
                                                                    </span>
                                                                </DropdownItem>
                                                            ))}
                                                        </DropdownMenu>
                                                    </DropdownPopover>
                                                </Dropdown>
                                            </Table.Cell>

                                            {/* Priority Selector (Inline Dropdown) */}
                                            <Table.Cell onClick={(e) => e.stopPropagation()}>
                                                <Dropdown>
                                                    <DropdownTrigger
                                                        className={cn(
                                                            buttonVariants({ variant: "outline", size: "sm" }),
                                                            "h-7 min-w-[90px] justify-between px-2 text-xs border border-default-200/50 hover:border-default-400 bg-background/50 rounded-lg cursor-pointer focus:outline-none"
                                                        )}
                                                        isDisabled={updating}
                                                    >
                                                        <span className="flex items-center gap-1.5 font-medium">
                                                            {PRIORITY_META[issue.priority].icon}
                                                            {PRIORITY_META[issue.priority].label}
                                                        </span>
                                                    </DropdownTrigger>
                                                    <DropdownPopover className="border border-default-100 bg-background/95 backdrop-blur-md shadow-lg" placement="bottom start">
                                                        <DropdownMenu
                                                            aria-label="Select Priority"
                                                            selectionMode="single"
                                                            selectedKeys={new Set([issue.priority])}
                                                            onSelectionChange={(keys) => {
                                                                const nextVal = Array.from(keys)[0] as IssuePriority;
                                                                if (nextVal) {
                                                                    runWorkflowUpdate(issue.id, { priority: nextVal });
                                                                }
                                                            }}
                                                        >
                                                            {PRIORITY_OPTIONS.map((opt) => (
                                                                <DropdownItem key={opt.value}>
                                                                    <span className="flex items-center gap-2">
                                                                        {opt.icon}
                                                                        {opt.label}
                                                                    </span>
                                                                </DropdownItem>
                                                            ))}
                                                        </DropdownMenu>
                                                    </DropdownPopover>
                                                </Dropdown>
                                            </Table.Cell>

                                            {/* Severity Selector (Inline Dropdown) */}
                                            <Table.Cell onClick={(e) => e.stopPropagation()}>
                                                <Dropdown>
                                                    <DropdownTrigger
                                                        className={cn(
                                                            buttonVariants({ variant: "outline", size: "sm" }),
                                                            "h-7 min-w-[95px] justify-between px-2 text-xs border border-default-200/50 hover:border-default-400 bg-background/50 rounded-lg font-medium cursor-pointer focus:outline-none"
                                                        )}
                                                        isDisabled={updating}
                                                    >
                                                        <span>
                                                            {SEVERITY_META[issue.severity ?? "MINOR"].label}
                                                        </span>
                                                    </DropdownTrigger>
                                                    <DropdownPopover className="border border-default-100 bg-background/95 backdrop-blur-md shadow-lg" placement="bottom start">
                                                        <DropdownMenu
                                                            aria-label="Select Severity"
                                                            selectionMode="single"
                                                            selectedKeys={new Set([issue.severity ?? "MINOR"])}
                                                            onSelectionChange={(keys) => {
                                                                const nextVal = Array.from(keys)[0] as IssueSeverity;
                                                                if (nextVal) {
                                                                    runWorkflowUpdate(issue.id, { severity: nextVal });
                                                                }
                                                            }}
                                                        >
                                                            {SEVERITY_OPTIONS.map((opt) => (
                                                                <DropdownItem key={opt.value}>
                                                                    {opt.label}
                                                                </DropdownItem>
                                                            ))}
                                                        </DropdownMenu>
                                                    </DropdownPopover>
                                                </Dropdown>
                                            </Table.Cell>

                                            {/* Assignee */}
                                            <Table.Cell>
                                                {issue.assignee ? (
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Avatar className="h-6 w-6 text-[10px]">
                                                            {issue.assignee.image && <Avatar.Image src={issue.assignee.image} className="object-cover h-full w-full" />}
                                                            <Avatar.Fallback>{(issue.assignee.name || "U").charAt(0).toUpperCase()}</Avatar.Fallback>
                                                        </Avatar>
                                                        <span className="truncate text-xs font-semibold text-foreground">
                                                            {issue.assignee.name}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-default-400">
                                                        Unassigned
                                                    </span>
                                                )}
                                            </Table.Cell>

                                            {/* Due Date */}
                                            <Table.Cell className="text-xs text-default-500 font-medium">
                                                {issue.dueDate
                                                    ? new Intl.DateTimeFormat("en-US", {
                                                          month: "short",
                                                          day: "numeric",
                                                      }).format(new Date(issue.dueDate))
                                                    : "—"}
                                            </Table.Cell>

                                            {/* Updated At */}
                                            <Table.Cell className="text-right text-xs font-mono text-default-400 font-medium">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {updating && (
                                                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                                    )}
                                                    {new Intl.DateTimeFormat("en-US", {
                                                        month: "short",
                                                        day: "numeric",
                                                    }).format(new Date(issue.updatedAt))}
                                                </div>
                                            </Table.Cell>
                                        </Table.Row>
                                    );
                                })
                            )}
                        </Table.Body>
                    </Table.Content>
                </Table>
            </div>
        </div>
    );
}
