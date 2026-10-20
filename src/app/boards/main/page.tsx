import { db } from "@/lib/db";
import { auth } from "@/../auth";
import Link from "next/link";
import { MainKanbanBoard, type KanbanIssue, type KanbanSubtask } from "./MainKanbanBoard";
import { BoardNewIssueButton } from "./BoardNewIssueButton";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { formatIssueRef } from "@/lib/issue-ids";
import type { IssuePriority, IssueStatus, IssueType } from "@/lib/issue-tokens";
import { cn } from "@/components/ui/cn";
import { assigneeUsers, issueAssigneeInclude, type IssueAssigneeUser } from "@/lib/issue-assignees";

function mapSubtask(s: {
    id: string;
    publicKey: string | null;
    title: string;
    status: string;
    priority: string;
    type: string;
    assignees: { user: IssueAssigneeUser }[];
}): KanbanSubtask {
    return {
        id: s.id,
        publicKey: s.publicKey,
        title: s.title,
        status: s.status as IssueStatus,
        priority: s.priority as IssuePriority,
        type: s.type as IssueType,
        assignees: assigneeUsers(s.assignees),
    };
}

export default async function MainBoardPage({
    searchParams,
}: {
    searchParams: Promise<{ assignee?: string }>;
}) {
    const session = await auth();
    const userId = session?.user?.id;
    const assignedToMe = (await searchParams).assignee === "me" && !!userId;
    const assignmentFilter = assignedToMe && userId ? { assignees: { some: { userId } } } : {};
    const rawIssues = await db.issue.findMany({
        where: assignmentFilter,
        orderBy: { updatedAt: "desc" },
        select: {
            id: true,
            publicKey: true,
            title: true,
            status: true,
            priority: true,
            type: true,
            assignees: issueAssigneeInclude,
            parentIssueId: true,
            parentIssue: {
                select: { id: true, publicKey: true },
            },
            subtasks: {
                where: assignmentFilter,
                orderBy: { createdAt: "asc" },
                select: {
                    id: true,
                    publicKey: true,
                    title: true,
                    status: true,
                    priority: true,
                    type: true,
                    assignees: issueAssigneeInclude,
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
            assignees: assigneeUsers(i.assignees),
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
            {userId && (
                <nav aria-label="Board assignment filter" className="flex flex-wrap gap-2">
                    {[
                        { href: "/boards/main", label: "All issues", active: !assignedToMe },
                        { href: "/boards/main?assignee=me", label: "Assigned to me", active: assignedToMe },
                    ].map(({ href, label, active }) => (
                        <Link
                            key={href}
                            href={href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                "inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium transition-colors focus-ring",
                                active
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            {label}
                        </Link>
                    ))}
                </nav>
            )}
            {assignedToMe && issues.length === 0 && (
                <p role="status" className="text-sm text-muted-foreground">
                    No issues are assigned to you.
                </p>
            )}
            <MainKanbanBoard issues={issues} interactive={canDrag} />
        </PageContainer>
    );
}
