"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Filter, GripVertical, Loader2, Search, X } from "lucide-react";
import { reorderBacklogIssue } from "@/app/actions";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { cn } from "@/components/ui/cn";
import { formatIssueRef } from "@/lib/issue-ids";
import {
    PRIORITY_META,
    TYPE_META,
    TYPE_OPTIONS,
    type IssuePriority,
    type IssueType,
    normalizePriority,
    normalizeType,
} from "@/lib/issue-tokens";

export type BacklogUser = {
    id: string;
    name: string | null;
    image: string | null;
};

export type BacklogIssue = {
    id: string;
    publicKey: string | null;
    title: string;
    type: IssueType;
    priority: IssuePriority;
    assignee: BacklogUser | null;
    dueDate?: Date | string | null;
    storyPoints?: number | null;
    parentIssueRef?: string | null;
    subtaskCount?: number;
    backlogRank: string | null;
};

function formatDue(dueDate: Date | string | null | undefined): string | null {
    if (!dueDate) return null;
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
    }).format(new Date(dueDate));
}

function BacklogRow({
    issue,
    interactive,
}: {
    issue: BacklogIssue;
    interactive: boolean;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: issue.id, disabled: !interactive });

    const issueRef = formatIssueRef(issue.publicKey, issue.id);
    const typeMeta = TYPE_META[normalizeType(issue.type)];
    const priorityMeta = PRIORITY_META[normalizePriority(issue.priority)];
    const due = formatDue(issue.dueDate);

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            className={cn(
                "flex items-center gap-2 border-b border-border px-2 py-1.5 last:border-b-0 hover:bg-muted/40",
                isDragging && "relative z-10 bg-surface opacity-70 ring-1 ring-primary"
            )}
        >
            {interactive ? (
                <button
                    type="button"
                    className="shrink-0 cursor-grab touch-none rounded p-1 text-subtle-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={`Reorder ${issue.title}`}
                    {...listeners}
                    {...attributes}
                >
                    <GripVertical className="h-3.5 w-3.5" />
                </button>
            ) : (
                <span className="inline-block w-7 shrink-0" aria-hidden />
            )}

            <Badge tone={typeMeta.tone} size="xs" className="shrink-0">
                {typeMeta.icon} {typeMeta.label}
            </Badge>
            <span
                className="inline-flex w-10 shrink-0 items-center gap-1 text-[10px] text-muted-foreground"
                title={priorityMeta.label}
            >
                {priorityMeta.icon} {priorityMeta.short}
            </span>

            <Link
                href={`/issues/${issueRef}`}
                className="w-20 shrink-0 font-mono text-[11px] text-muted-foreground transition-colors hover:text-primary"
            >
                {issueRef}
            </Link>

            <Link
                href={`/issues/${issueRef}`}
                className="min-w-0 flex-1 truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
            >
                {issue.parentIssueRef && (
                    <span className="mr-1.5 font-mono text-[10px] font-normal text-subtle-foreground">
                        ↳ {issue.parentIssueRef}
                    </span>
                )}
                {issue.title}
                {(issue.subtaskCount ?? 0) > 0 && (
                    <span className="ml-2 inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground align-middle">
                        {issue.subtaskCount} subtask{issue.subtaskCount === 1 ? "" : "s"}
                    </span>
                )}
            </Link>

            <div className="hidden w-36 shrink-0 items-center gap-1.5 sm:flex">
                {issue.assignee ? (
                    <>
                        <Avatar
                            src={issue.assignee.image}
                            name={issue.assignee.name}
                            size="xs"
                        />
                        <span className="truncate text-xs text-foreground">
                            {issue.assignee.name}
                        </span>
                    </>
                ) : (
                    <span className="text-xs text-subtle-foreground">Unassigned</span>
                )}
            </div>

            <span className="hidden w-10 shrink-0 text-right text-[11px] font-medium text-muted-foreground md:inline">
                {issue.storyPoints != null ? issue.storyPoints : ""}
            </span>
            <span className="hidden w-16 shrink-0 text-right text-[11px] text-muted-foreground md:inline">
                {due ?? ""}
            </span>
        </div>
    );
}

export function BacklogRankedList({
    issues,
    interactive = true,
}: {
    issues: BacklogIssue[];
    interactive?: boolean;
}) {
    const router = useRouter();
    const [items, setItems] = useState(issues);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("ALL");
    const [assigneeFilter, setAssigneeFilter] = useState("ALL");
    const [pending, startTransition] = useTransition();

    useEffect(() => {
        setItems(issues);
    }, [issues]);

    const assignees = useMemo(() => {
        const map = new Map<string, BacklogUser>();
        for (const issue of items) {
            if (issue.assignee && !map.has(issue.assignee.id)) {
                map.set(issue.assignee.id, issue.assignee);
            }
        }
        return Array.from(map.values()).sort((a, b) =>
            (a.name || "").localeCompare(b.name || "")
        );
    }, [items]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter((issue) => {
            if (typeFilter !== "ALL" && normalizeType(issue.type) !== typeFilter) {
                return false;
            }
            if (assigneeFilter === "UNASSIGNED") {
                if (issue.assignee) return false;
            } else if (assigneeFilter !== "ALL" && issue.assignee?.id !== assigneeFilter) {
                return false;
            }
            if (!q) return true;
            const ref = formatIssueRef(issue.publicKey, issue.id).toLowerCase();
            return issue.title.toLowerCase().includes(q) || ref.includes(q);
        });
    }, [assigneeFilter, items, search, typeFilter]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const hasFilters = typeFilter !== "ALL" || assigneeFilter !== "ALL" || search.trim() !== "";

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const fromIndex = visible.findIndex((i) => i.id === String(active.id));
        const toIndex = visible.findIndex((i) => i.id === String(over.id));
        if (fromIndex < 0 || toIndex < 0) return;

        const nextVisible = arrayMove(visible, fromIndex, toIndex);
        const movedId = String(active.id);
        const newIndex = nextVisible.findIndex((i) => i.id === movedId);
        const afterId = nextVisible[newIndex - 1]?.id ?? null;
        const beforeId = nextVisible[newIndex + 1]?.id ?? null;

        const previous = items;
        const visibleIds = new Set(visible.map((i) => i.id));
        const nextItems = [...items];
        const fullFrom = nextItems.findIndex((i) => i.id === movedId);
        if (fullFrom >= 0) {
            const [moved] = nextItems.splice(fullFrom, 1);
            if (!moved) return;

            let insertAt = nextItems.length;
            if (afterId) {
                const afterIdx = nextItems.findIndex((i) => i.id === afterId);
                insertAt = afterIdx >= 0 ? afterIdx + 1 : nextItems.length;
            } else if (beforeId) {
                const beforeIdx = nextItems.findIndex((i) => i.id === beforeId);
                insertAt = beforeIdx >= 0 ? beforeIdx : 0;
            } else if (visibleIds.size === 1) {
                insertAt = fullFrom > nextItems.length ? nextItems.length : fullFrom;
            }
            nextItems.splice(insertAt, 0, moved);
            setItems(nextItems);
        }

        startTransition(async () => {
            const res = await reorderBacklogIssue(movedId, afterId, beforeId);
            if (res?.error) {
                setItems(previous);
                alert(res.error);
                return;
            }
            router.refresh();
        });
    };

    const list = (
        <Card className="overflow-hidden">
            <div className="hidden items-center gap-2 border-b border-border bg-surface-2 px-2 py-1.5 text-[10px] uppercase tracking-wider text-subtle-foreground sm:flex">
                <span className="w-7 shrink-0" aria-hidden />
                <span className="w-[4.5rem] shrink-0">Type</span>
                <span className="w-10 shrink-0">Pri</span>
                <span className="w-20 shrink-0">Key</span>
                <span className="min-w-0 flex-1">Title</span>
                <span className="w-36 shrink-0">Assignee</span>
                <span className="hidden w-10 shrink-0 text-right md:inline">Pts</span>
                <span className="hidden w-16 shrink-0 text-right md:inline">Due</span>
            </div>

            {visible.length === 0 ? (
                <p className="px-4 py-12 text-center text-xs text-muted-foreground">
                    {items.length === 0
                        ? "No issues in the backlog."
                        : "No issues match your filters."}
                </p>
            ) : (
                <SortableContext
                    items={visible.map((i) => i.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {visible.map((issue) => (
                        <BacklogRow key={issue.id} issue={issue} interactive={interactive} />
                    ))}
                </SortableContext>
            )}
        </Card>
    );

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-2">
                <div className="flex items-center gap-1.5 px-1.5 text-[11px] uppercase tracking-wider text-subtle-foreground">
                    <Filter className="h-3 w-3" />
                    Filter
                </div>
                <div className="relative min-w-[160px] max-w-xs flex-1">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-subtle-foreground" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search…"
                        className="h-7 w-full rounded-md border border-input bg-elevated pl-7 pr-2 text-xs transition-colors focus-ring hover:border-border-strong"
                    />
                </div>
                <Select
                    size="xs"
                    value={typeFilter}
                    onChange={setTypeFilter}
                    options={[{ value: "ALL", label: "Type · All" }, ...TYPE_OPTIONS]}
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
                {hasFilters && (
                    <button
                        type="button"
                        onClick={() => {
                            setTypeFilter("ALL");
                            setAssigneeFilter("ALL");
                            setSearch("");
                        }}
                        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <X className="h-3 w-3" />
                        Clear
                    </button>
                )}
                <div className={cn("text-[11px] text-subtle-foreground", !hasFilters && "ml-auto")}>
                    {visible.length} of {items.length}
                </div>
            </div>

            {pending && (
                <p className="inline-flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground" aria-live="polite">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving order…
                </p>
            )}

            {interactive ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    {list}
                </DndContext>
            ) : (
                list
            )}
        </div>
    );
}
