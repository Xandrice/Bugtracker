"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    DndContext,
    DragEndEvent,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { updateIssueWorkflow } from "@/app/actions";
import { formatIssueRef } from "@/lib/issue-ids";
import { cn } from "@/components/ui/cn";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import {
    PRIORITY_META,
    STATUS_META,
    STATUS_OPTIONS,
    TYPE_META,
    type IssuePriority,
    type IssueStatus,
    type IssueType,
} from "@/lib/issue-tokens";

export type KanbanSubtask = {
    id: string;
    publicKey: string | null;
    title: string;
    status: IssueStatus;
    priority: IssuePriority;
    type: IssueType;
};

export type KanbanIssue = {
    id: string;
    publicKey: string | null;
    title: string;
    status: IssueStatus;
    priority: IssuePriority;
    type: IssueType;
    parentIssueId: string | null;
    /** Shown when this card is an orphaned subtask (parent not on board). */
    orphanParentRef?: string | null;
    subtasks: KanbanSubtask[];
};

const COLUMNS: { status: IssueStatus; title: string }[] = [
    { status: "BACKLOG", title: "Backlog" },
    { status: "OPEN", title: "Open" },
    { status: "IN_PROGRESS", title: "In progress" },
    { status: "REVIEW", title: "Review" },
    { status: "DONE", title: "Done" },
];

const VALID_STATUS = ["BACKLOG", "OPEN", "IN_PROGRESS", "REVIEW", "DONE"] as const;

function normalizeIssueStatus(status: string): IssueStatus {
    return (VALID_STATUS as readonly string[]).includes(status)
        ? (status as IssueStatus)
        : "OPEN";
}

function SubtaskRow({
    subtask,
    interactive,
}: {
    subtask: KanbanSubtask;
    interactive: boolean;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const issueRef = formatIssueRef(subtask.publicKey, subtask.id);
    const status = normalizeIssueStatus(subtask.status);
    const meta = STATUS_META[status];

    const onStatusChange = (next: string) => {
        if (!interactive || next === status) return;
        startTransition(async () => {
            const res = await updateIssueWorkflow(subtask.id, { status: next });
            if (res?.error) {
                alert(res.error);
                return;
            }
            router.refresh();
        });
    };

    return (
        <div className="flex items-center gap-1.5 rounded border border-transparent px-1.5 py-1 hover:border-border hover:bg-muted/40">
            {interactive ? (
                <div className="w-[7.5rem] shrink-0">
                    <Select
                        value={status}
                        onChange={onStatusChange}
                        options={STATUS_OPTIONS}
                        size="xs"
                        disabled={pending}
                        aria-label={`Status for ${subtask.title}`}
                    />
                </div>
            ) : (
                <span
                    className={cn(
                        "shrink-0",
                        status === "DONE" ? "text-success" : "text-muted-foreground"
                    )}
                    title={meta.label}
                >
                    {meta.icon}
                </span>
            )}
            <Link
                href={`/issues/${issueRef}`}
                className={cn(
                    "min-w-0 flex-1 truncate text-[11px] text-foreground hover:text-primary",
                    status === "DONE" && "text-muted-foreground line-through"
                )}
            >
                {subtask.title}
            </Link>
        </div>
    );
}

function KanbanCard({
    issue,
    interactive,
}: {
    issue: KanbanIssue;
    interactive: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const issueRef = formatIssueRef(issue.publicKey, issue.id);
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: issue.id,
        data: { issue },
        disabled: !interactive,
    });

    const style = transform
        ? {
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
              zIndex: isDragging ? 10 : undefined,
          }
        : undefined;

    const wfPriority = (["URGENT", "HIGH", "MEDIUM", "LOW"] as const).includes(
        issue.priority as IssuePriority
    )
        ? issue.priority
        : "MEDIUM";
    const wfType = (["BUG", "FEATURE", "TASK"] as const).includes(issue.type as IssueType)
        ? issue.type
        : "TASK";

    const typeMeta = TYPE_META[wfType];
    const priorityMeta = PRIORITY_META[wfPriority];
    const subtaskTotal = issue.subtasks.length;
    const subtaskDone = issue.subtasks.filter((s) => normalizeIssueStatus(s.status) === "DONE").length;
    const hasSubtasks = subtaskTotal > 0;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "rounded-md border border-border bg-surface p-2.5 transition-colors hover:border-border-strong",
                isDragging && "opacity-60 ring-1 ring-primary"
            )}
        >
            <div className="flex gap-2">
                {interactive ? (
                    <button
                        type="button"
                        className="mt-0.5 shrink-0 cursor-grab touch-none text-subtle-foreground transition-colors hover:text-foreground"
                        aria-label="Drag issue"
                        {...listeners}
                        {...attributes}
                    >
                        <GripVertical className="h-3.5 w-3.5" />
                    </button>
                ) : (
                    <span className="mt-0.5 w-3.5 shrink-0" aria-hidden />
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[10px] text-muted-foreground">{issueRef}</span>
                        <Badge tone={typeMeta.tone} size="xs">
                            {typeMeta.icon} {typeMeta.label}
                        </Badge>
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            {priorityMeta.icon} {priorityMeta.short}
                        </span>
                        {hasSubtasks && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {subtaskDone}/{subtaskTotal}
                            </span>
                        )}
                        {issue.orphanParentRef && (
                            <span className="text-[10px] text-subtle-foreground">
                                ↳ {issue.orphanParentRef}
                            </span>
                        )}
                    </div>
                    <Link
                        href={`/issues/${issueRef}`}
                        className="block text-sm font-medium leading-snug text-foreground hover:text-primary"
                    >
                        {issue.title}
                    </Link>

                    {hasSubtasks && (
                        <div className="pt-0.5">
                            <button
                                type="button"
                                onClick={() => setExpanded((v) => !v)}
                                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                                aria-expanded={expanded}
                            >
                                {expanded ? (
                                    <ChevronDown className="h-3 w-3" />
                                ) : (
                                    <ChevronRight className="h-3 w-3" />
                                )}
                                {subtaskTotal} subtask{subtaskTotal === 1 ? "" : "s"}
                            </button>
                            {expanded && (
                                <div className="mt-1.5 space-y-0.5 border-l border-border pl-2">
                                    {issue.subtasks.map((sub) => (
                                        <SubtaskRow
                                            key={sub.id}
                                            subtask={sub}
                                            interactive={interactive}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function KanbanColumn({
    status,
    title,
    issues,
    interactive,
}: {
    status: IssueStatus;
    title: string;
    issues: KanbanIssue[];
    interactive: boolean;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !interactive });

    return (
        <div className="flex min-w-[280px] max-w-[340px] flex-1 flex-col rounded-md border border-border bg-surface/50">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div className="flex items-center gap-2">
                    <span className="text-foreground">{STATUS_META[status].icon}</span>
                    <span className="text-xs font-semibold text-foreground">{title}</span>
                </div>
                <span className="text-[11px] text-muted-foreground">{issues.length}</span>
            </div>
            <div
                ref={setNodeRef}
                className={cn(
                    "flex min-h-[280px] flex-1 flex-col gap-2 p-2 transition-colors",
                    isOver && "bg-primary/5"
                )}
            >
                {issues.map((issue) => (
                    <KanbanCard key={issue.id} issue={issue} interactive={interactive} />
                ))}
                {issues.length === 0 && (
                    <p className="py-8 text-center text-[11px] text-subtle-foreground">
                        {interactive ? "Drop issues here" : "No issues in this column"}
                    </p>
                )}
            </div>
        </div>
    );
}

export function MainKanbanBoard({
    issues,
    interactive = true,
}: {
    issues: KanbanIssue[];
    interactive?: boolean;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    /** Roots only for columns; subtasks live nested under parents. */
    const rootIssues = useMemo(
        () => issues.filter((i) => !i.parentIssueId || i.orphanParentRef),
        [issues]
    );

    const byStatus = useMemo(() => {
        const map: Record<IssueStatus, KanbanIssue[]> = {
            BACKLOG: [],
            OPEN: [],
            IN_PROGRESS: [],
            REVIEW: [],
            DONE: [],
        };
        for (const issue of rootIssues) {
            const s = normalizeIssueStatus(issue.status);
            map[s].push({ ...issue, status: s });
        }
        return map;
    }, [rootIssues]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        })
    );

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const issueId = String(active.id);
        const overId = String(over.id);
        let nextStatus: IssueStatus | null = null;
        if ((VALID_STATUS as readonly string[]).includes(overId)) {
            nextStatus = overId as IssueStatus;
        } else {
            const targetIssue = rootIssues.find((i) => i.id === overId);
            if (targetIssue) {
                nextStatus = normalizeIssueStatus(targetIssue.status);
            }
        }
        if (!nextStatus) return;

        const from = active.data.current?.issue as KanbanIssue | undefined;
        if (!from || from.status === nextStatus) return;

        startTransition(async () => {
            const res = await updateIssueWorkflow(issueId, { status: nextStatus });
            if (res?.error) {
                alert(res.error);
                return;
            }
            router.refresh();
        });
    };

    const board = (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:overflow-x-auto lg:pb-2">
            {COLUMNS.map((col) => (
                <KanbanColumn
                    key={col.status}
                    status={col.status}
                    title={col.title}
                    issues={byStatus[col.status]}
                    interactive={interactive}
                />
            ))}
        </div>
    );

    if (!interactive) return board;

    return (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            {pending && (
                <p className="mb-2 text-center text-[11px] text-muted-foreground" aria-live="polite">
                    Updating board…
                </p>
            )}
            {board}
        </DndContext>
    );
}
