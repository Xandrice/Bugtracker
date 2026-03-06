"use client"

import { useState, forwardRef, useEffect } from "react"
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
    defaultDropAnimationSideEffects,
    useDroppable
} from "@dnd-kit/core"
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { IssueSnippet, StatusIcon, PriorityIcon, TypeIcon } from "./DataGrid"
import { updateIssueStatus } from "@/app/actions"

interface KanbanBoardProps {
    issues: IssueSnippet[]
    onIssueMove?: (issueId: string, newStatus: string) => void
}

const COLUMNS = [
    { id: "OPEN", title: "To Do" },
    { id: "IN_PROGRESS", title: "In Progress" },
    { id: "REVIEW", title: "Review" },
    { id: "DONE", title: "Done" }
]

const IssueCard = forwardRef<HTMLDivElement, { issue: IssueSnippet, isOverlay?: boolean } & React.HTMLAttributes<HTMLDivElement>>(
    ({ issue, isOverlay, className = "", ...props }, ref) => {
        return (
            <div
                ref={ref}
                {...props}
                className={`p-3 bg-background border rounded-md shadow-sm mb-3 flex flex-col gap-2 cursor-grab transition-all hover:border-primary/50 relative overflow-hidden
                    ${isOverlay ? 'scale-105 shadow-2xl rotate-2 z-50 cursor-grabbing border-primary ring-2 ring-primary ring-offset-2' : ''} 
                    ${className}`}
            >
                <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-tight select-none">
                        {issue.title}
                    </span>
                    <div className="shrink-0 flex items-center space-x-1">
                        <TypeIcon type={issue.type} />
                    </div>
                </div>

                <div className="flex items-center justify-between mt-2 select-none">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{issue.id.slice(-5)}</span>
                        <PriorityIcon priority={issue.priority} />
                    </div>

                    {issue.assignee && (
                        issue.assignee.image ? (
                            <img
                                src={issue.assignee.image}
                                alt={issue.assignee.name || "Assignee"}
                                className="w-5 h-5 rounded-full border border-border object-cover"
                                title={issue.assignee.name ?? ""}
                            />
                        ) : (
                            <div
                                className="w-5 h-5 rounded-full border border-border bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0"
                                title={issue.assignee.name ?? "Assignee"}
                            >
                                {issue.assignee.name?.charAt(0).toUpperCase() || "A"}
                            </div>
                        )
                    )}
                </div>
            </div>
        )
    }
)

IssueCard.displayName = "IssueCard"

function SortableItem({ issue }: { issue: IssueSnippet }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: issue.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    if (isDragging) {
        return (
            <div ref={setNodeRef} style={style} className="opacity-30 p-3 bg-muted/50 border-2 border-dashed border-primary/50 rounded-md mb-3 h-[100px]" />
        )
    }

    return (
        <IssueCard
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            issue={issue}
        />
    )
}

function Column({ id, title, issues }: { id: string, title: string, issues: IssueSnippet[] }) {
    const { setNodeRef, isOver } = useDroppable({ id });

    return (
        <div ref={setNodeRef} className={`flex flex-col flex-1 shrink-0 w-80 bg-muted/40 rounded-lg border transition-colors ${isOver ? 'border-primary/50 bg-muted/60' : 'border-border/50'}`}>
            <div className="p-3 border-b border-border/50 bg-muted/20 flex items-center justify-between rounded-t-lg pointer-events-none">
                <h3 className="font-semibold text-sm">{title}</h3>
                <span className="text-xs font-medium bg-background px-2 py-0.5 rounded-full border text-muted-foreground">
                    {issues.length}
                </span>
            </div>

            <div className="p-3 flex-1 overflow-y-auto min-h-[500px]">
                <SortableContext
                    items={issues.map(i => i.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {issues.map(issue => (
                        <SortableItem key={issue.id} issue={issue} />
                    ))}
                </SortableContext>

                {issues.length === 0 && (
                    <div className="h-full flex items-center justify-center border-2 border-dashed border-border/50 rounded-md p-4 text-center">
                        <span className="text-xs text-muted-foreground pointer-events-none">Drop issues here</span>
                    </div>
                )}
            </div>
        </div>
    )
}

export function KanbanBoard({ issues: initialIssues, onIssueMove }: KanbanBoardProps) {
    const [issues, setIssues] = useState(initialIssues)
    const [activeId, setActiveId] = useState<string | null>(null)

    useEffect(() => {
        setIssues(initialIssues);
    }, [initialIssues]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
        useSensor(KeyboardSensor)
    )

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string)
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveId(null)
        const { active, over } = event

        if (!over) return

        const issueId = active.id as string;
        let newStatus = over.id as string;

        const isColumn = COLUMNS.some(c => c.id === newStatus);

        if (!isColumn) {
            const overIssue = issues.find(i => i.id === over.id);
            if (overIssue) {
                newStatus = overIssue.status;
            } else {
                return;
            }
        }

        const activeIssue = issues.find(i => i.id === issueId);
        if (activeIssue && activeIssue.status !== newStatus) {
            const updated = issues.map(i => i.id === issueId ? { ...i, status: newStatus as any } : i);
            setIssues(updated);
            try {
                const res = await updateIssueStatus(issueId, newStatus);
                if (res && res.error) {
                    setIssues(issues); // revert on error
                }
            } catch (err) {
                setIssues(issues); // revert on error
            }
        }
    }

    const getIssuesForColumn = (statusId: string) => {
        return issues.filter(i => i.status === statusId)
    }

    const activeIssue = activeId ? issues.find(i => i.id === activeId) : null;

    return (
        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 w-full h-full items-start">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setActiveId(null)}
            >
                {COLUMNS.map(col => (
                    <Column
                        key={col.id}
                        id={col.id}
                        title={col.title}
                        issues={getIssuesForColumn(col.id)}
                    />
                ))}

                <DragOverlay dropAnimation={{
                    sideEffects: defaultDropAnimationSideEffects({
                        styles: { active: { opacity: '0.4' } }
                    })
                }}>
                    {activeIssue ? <IssueCard issue={activeIssue} isOverlay /> : null}
                </DragOverlay>
            </DndContext>
        </div>
    )
}
