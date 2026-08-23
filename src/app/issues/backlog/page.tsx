import { auth } from "@/../auth";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { formatIssueRef } from "@/lib/issue-ids";
import {
    normalizePriority,
    normalizeType,
} from "@/lib/issue-tokens";
import { ensureMissingBacklogRanks } from "@/lib/issue-backlog";
import { BacklogRankedList, type BacklogIssue } from "./BacklogRankedList";

export default async function BacklogIssuesPage() {
    const session = await auth();
    await ensureMissingBacklogRanks();

    const rawIssues = await db.issue.findMany({
        where: { status: "BACKLOG" },
        include: {
            assignee: true,
            parentIssue: { select: { id: true, publicKey: true } },
            _count: { select: { subtasks: true } },
        },
        orderBy: [
            { backlogRank: { sort: "asc", nulls: "last" } },
            { id: "asc" },
        ],
    });

    const issues: BacklogIssue[] = rawIssues.map((i) => ({
        id: i.id,
        publicKey: i.publicKey ?? null,
        title: i.title,
        type: normalizeType(i.type),
        priority: normalizePriority(i.priority),
        assignee: i.assignee
            ? { id: i.assignee.id, name: i.assignee.name, image: i.assignee.image }
            : null,
        dueDate: i.dueDate ?? undefined,
        storyPoints: i.storyPoints ?? undefined,
        parentIssueRef: i.parentIssue
            ? formatIssueRef(i.parentIssue.publicKey, i.parentIssue.id)
            : null,
        subtaskCount: i._count?.subtasks ?? 0,
        backlogRank: i.backlogRank ?? null,
    }));

    const canRank = !!session?.user?.id;

    return (
        <PageContainer>
            <PageHeader
                title="Backlog"
                description="Drag issues into a stable order. New backlog items land at the bottom."
                actions={
                    session?.user?.id && (
                        <Link
                            href="/issues/new?status=BACKLOG"
                            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            New issue
                        </Link>
                    )
                }
            />
            {!canRank && (
                <p className="text-xs text-warning">Sign in to reorder the backlog.</p>
            )}
            <BacklogRankedList issues={issues} interactive={canRank} />
        </PageContainer>
    );
}
