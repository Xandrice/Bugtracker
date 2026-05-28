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
import { GripVertical } from "lucide-react";
import { updateIssueWorkflow } from "@/app/actions";
import { formatIssueRef } from "@/lib/issue-ids";
import { cn } from "@/components/ui/cn";
import { Badge } from "@/components/ui/Badge";
import {
    PRIORITY_META,
    STATUS_META,
    TYPE_META,
    type IssuePriority,
    type IssueStatus,
    type IssueType,
} from "@/lib/issue-tokens";

export type KanbanIssue = {
    id: string;
    publicKey: string | null;
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

function KanbanCard({
    issue,
    interactive,
}: {
    issue: KanbanIssue;
    interactive: boolean;
}) {
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
                    </div>
                    <Link
                        href={`/issues/${issueRef}`}
                        className="block text-sm font-medium leading-snug text-foreground hover:text-primary"
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
                nextStatus = (["OPEN", "IN_PROGRESS", "REVIEW", "DONE"] as const).includes(s)
                    ? s
                    : "OPEN";
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
