"use client";

import { useMemo, useTransition } from "react";
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
import { clsx } from "clsx";
import { GripVertical } from "lucide-react";
import { updateIssueWorkflow } from "@/app/actions";
import { formatIssueRef } from "@/lib/issue-ids";
import {
    PriorityIcon,
    TypeIcon,
    priorityLabels,
    statusStyles,
    typeStyles,
    type IssuePriority,
    type IssueStatus,
    type IssueType,
} from "@/components/views/DataGrid";

export type KanbanIssue = {
    id: string;
    issueNumber: number | null;
    title: string;
    status: IssueStatus;
    priority: IssuePriority;
    type: IssueType;
};

const COLUMNS: { status: IssueStatus; title: string }[] = [
    { status: "OPEN", title: "Open" },
    { status: "IN_PROGRESS", title: "In progress" },
    { status: "REVIEW", title: "Review" },
    { status: "DONE", title: "Done" },
];

function KanbanCard({ issue, interactive }: { issue: KanbanIssue; interactive: boolean }) {
    const issueRef = formatIssueRef(issue.issueNumber, issue.id);
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: issue.id,
        data: { issue },
        disabled: !interactive,
    });

    const style = transform
        ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: isDragging ? 10 : undefined }
        : undefined;

    const wfPriority = (["URGENT", "HIGH", "MEDIUM", "LOW"] as const).includes(issue.priority as IssuePriority)
        ? issue.priority
        : "MEDIUM";
    const wfType = (["BUG", "FEATURE", "TASK"] as const).includes(issue.type as IssueType) ? issue.type : "TASK";

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={clsx(
                "rounded-lg border border-border/80 bg-muted/25 p-2.5 shadow-sm",
                isDragging && "opacity-60 ring-2 ring-primary/40"
            )}
        >
            <div className="flex gap-2">
                {interactive ? (
                    <button
                        type="button"
                        className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground"
                        aria-label="Drag issue"
                        {...listeners}
                        {...attributes}
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>
                ) : (
                    <span className="mt-0.5 w-4 shrink-0" aria-hidden />
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1">
                        <span className="font-mono text-[10px] uppercase text-primary">{issueRef}</span>
                        <span
                            className={clsx(
                                "inline-flex items-center gap-0.5 rounded border px-1 py-px text-[10px] font-medium",
                                typeStyles[wfType]
                            )}
                        >
                            <TypeIcon type={wfType} /> {wfType}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <PriorityIcon priority={wfPriority} /> {priorityLabels[wfPriority]}
                        </span>
                    </div>
                    <Link
                        href={`/issues/${issueRef}`}
                        className="block text-sm font-medium leading-snug text-foreground hover:text-primary hover:underline"
                    >
                        {issue.title}
                    </Link>
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
        <div className="flex min-w-[260px] max-w-[320px] flex-1 flex-col rounded-xl border border-border/70 bg-background/40">
            <div className="border-b border-border/60 px-3 py-2">
                <h3 className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
                    <span>{title}</span>
                    <span
                        className={clsx(
                            "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                            statusStyles[status]
                        )}
                    >
                        {issues.length}
                    </span>
                </h3>
            </div>
            <div
                ref={setNodeRef}
                className={clsx(
                    "flex min-h-[280px] flex-1 flex-col gap-2 p-2 transition-colors",
                    isOver && "bg-primary/5 ring-1 ring-primary/25"
                )}
            >
                {issues.map((issue) => (
                    <KanbanCard key={issue.id} issue={issue} interactive={interactive} />
                ))}
                {issues.length === 0 && (
                    <p className="py-8 text-center text-xs text-muted-foreground">
                        {interactive ? "Drop issues here" : "No issues in this column"}
                    </p>
                )}
            </div>
        </div>
    );
}

export function MainKanbanBoard({ issues, interactive = true }: { issues: KanbanIssue[]; interactive?: boolean }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    const byStatus = useMemo(() => {
        const map: Record<IssueStatus, KanbanIssue[]> = {
            OPEN: [],
            IN_PROGRESS: [],
            REVIEW: [],
            DONE: [],
        };
        for (const issue of issues) {
            const s = (["OPEN", "IN_PROGRESS", "REVIEW", "DONE"] as const).includes(issue.status)
                ? issue.status
                : "OPEN";
            map[s].push({ ...issue, status: s });
        }
        return map;
    }, [issues]);

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
        if (["OPEN", "IN_PROGRESS", "REVIEW", "DONE"].includes(overId)) {
            nextStatus = overId as IssueStatus;
        } else {
            const targetIssue = issues.find((i) => i.id === overId);
            if (targetIssue) {
                const s = targetIssue.status;
                nextStatus = (["OPEN", "IN_PROGRESS", "REVIEW", "DONE"] as const).includes(s) ? s : "OPEN";
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:overflow-x-auto lg:pb-2">
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

    if (!interactive) {
        return board;
    }

    return (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            {pending && (
                <p className="mb-3 text-center text-xs text-muted-foreground" aria-live="polite">
                    Updating board…
                </p>
            )}
            {board}
        </DndContext>
    );
}
