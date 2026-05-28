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
import { Card, CardContent, Chip } from "@heroui/react";
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
        <Card
            ref={setNodeRef}
            style={style}
            className={cn(
                "border border-default-100 bg-background/60 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-default-300/80 hover:shadow-md cursor-default select-none shadow-sm",
                isDragging && "opacity-60 ring-2 ring-primary/80 shadow-lg shadow-primary/20 scale-[1.01]"
            )}
        >
            <CardContent className="p-3">
                <div className="flex gap-2">
                    {interactive ? (
                        <button
                           type="button"
                           className="mt-0.5 shrink-0 cursor-grab touch-none text-default-400 hover:text-foreground transition-colors"
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
                            <span className="font-mono text-[10px] text-default-450 font-semibold">{issueRef}</span>
                            <Chip
                                size="sm"
                                variant="soft"
                                color={toneToColor(typeMeta.tone)}
                                className="inline-flex items-center gap-1 border border-default-250/20 px-1.5 h-5 text-[9px] font-semibold"
                            >
                                {typeMeta.icon}
                                {typeMeta.label}
                            </Chip>
                            <span className="inline-flex items-center gap-1 text-[10px] text-default-500 font-semibold">
                                {priorityMeta.icon} {priorityMeta.short}
                            </span>
                        </div>
                        <Link
                            href={`/issues/${issueRef}`}
                            className="block text-sm font-semibold leading-snug text-foreground hover:text-primary transition-colors"
                        >
                            {issue.title}
                        </Link>
                    </div>
                </div>
            </CardContent>
        </Card>
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
        <div className="flex min-w-[280px] max-w-[340px] flex-1 flex-col rounded-xl border border-default-100 bg-default-50/20 backdrop-blur-md shadow-sm">
            <div className="flex items-center justify-between border-b border-default-100 px-3.5 py-2.5 bg-default-50/30">
                <div className="flex items-center gap-2">
                    <span className="text-default-500">{STATUS_META[status].icon}</span>
                    <span className="text-xs font-bold text-foreground">{title}</span>
                </div>
                <Chip 
                    size="sm" 
                    variant="soft" 
                    color={toneToColor(STATUS_META[status].tone)}
                    className="h-5 min-w-[20px] px-1 text-[10px] font-bold border border-default-250/20"
                >
                    {issues.length}
                </Chip>
            </div>
            <div
                ref={setNodeRef}
                className={cn(
                    "flex min-h-[350px] flex-1 flex-col gap-2.5 p-3 transition-all duration-200 rounded-b-xl",
                    isOver && "bg-primary/5 ring-1 ring-primary/10"
                )}
            >
                {issues.map((issue) => (
                    <KanbanCard key={issue.id} issue={issue} interactive={interactive} />
                ))}
                {issues.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-default-200/50 rounded-xl flex-grow bg-default-50/5">
                        <p className="text-[11px] font-semibold text-default-400">
                            {interactive ? "Drop issues here" : "No issues in this column"}
                        </p>
                    </div>
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
                <p className="mb-2 text-center text-[11px] text-muted-foreground animate-pulse" aria-live="polite">
                    Updating board…
                </p>
            )}
            {board}
        </DndContext>
    );
}
