import { db } from "@/lib/db";
import { auth } from "@/../auth";
import { MainKanbanBoard, type KanbanIssue, type KanbanSubtask } from "./MainKanbanBoard";
import { BoardNewIssueButton } from "./BoardNewIssueButton";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { formatIssueRef } from "@/lib/issue-ids";
import type { IssuePriority, IssueStatus, IssueType } from "@/lib/issue-tokens";

function mapSubtask(s: {
    id: string;
    publicKey: string | null;
    title: string;
    status: string;
    priority: string;
    type: string;
}): KanbanSubtask {
    return {
        id: s.id,
        publicKey: s.publicKey,
        title: s.title,
        status: s.status as IssueStatus,
        priority: s.priority as IssuePriority,
        type: s.type as IssueType,
    };
}

export default async function MainBoardPage() {
    const session = await auth();
    const rawIssues = await db.issue.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
            id: true,
            publicKey: true,
            title: true,
            status: true,
            priority: true,
            type: true,
            parentIssueId: true,
            parentIssue: {
                select: { id: true, publicKey: true },
            },
            subtasks: {
                orderBy: { createdAt: "asc" },
                select: {
                    id: true,
                    publicKey: true,
                    title: true,
                    status: true,
                    priority: true,
                    type: true,
                },
            },
        },
    });

    const idSet = new Set(rawIssues.map((i) => i.id));

    const issues: KanbanIssue[] = rawIssues.map((i) => {
        const parentMissing = !!i.parentIssueId && !idSet.has(i.parentIssueId);
        return {
            id: i.id,
            publicKey: i.publicKey ?? null,
            title: i.title,
            status: i.status as IssueStatus,
            priority: i.priority as IssuePriority,
            type: i.type as IssueType,
            parentIssueId: i.parentIssueId,
            orphanParentRef: parentMissing
                ? formatIssueRef(i.parentIssue?.publicKey ?? null, i.parentIssueId!)
                : null,
            // Only attach subtasks on root cards (and orphans treated as roots).
            subtasks:
                !i.parentIssueId || parentMissing
                    ? i.subtasks.map(mapSubtask)
                    : [],
        };
    });

    const canDrag = !!session?.user?.id;

    return (
        <PageContainer>
            <PageHeader
                title="Main board"
                description="Drag parent cards between columns. Expand a card to manage its subtasks."
                actions={<BoardNewIssueButton />}
            />
            {!canDrag && (
                <p className="text-xs text-warning">
                    Sign in to move cards on the board.
                </p>
            )}
            <MainKanbanBoard issues={issues} interactive={canDrag} />
        </PageContainer>
    );
}
