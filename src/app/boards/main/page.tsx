import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { auth } from "@/../auth";
import { MainKanbanBoard, type KanbanIssue } from "./MainKanbanBoard";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";

export default async function MainBoardPage() {
    const session = await auth();
    const rawIssues = await db.issue.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
            id: true,
            issueNumber: true,
            title: true,
            status: true,
            priority: true,
            type: true,
        },
    });

    const issues: KanbanIssue[] = rawIssues.map((i) => ({
        id: i.id,
        issueNumber: i.issueNumber ?? null,
        title: i.title,
        status: i.status as KanbanIssue["status"],
        priority: i.priority as KanbanIssue["priority"],
        type: i.type as KanbanIssue["type"],
    }));

    const canDrag = !!session?.user?.id;

    return (
        <PageContainer>
            <PageHeader
                title="Main board"
                description="Drag cards between columns to update status."
                actions={
                    <Link
                        href="/issues/new"
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-8 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        New issue
                    </Link>
                }
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
