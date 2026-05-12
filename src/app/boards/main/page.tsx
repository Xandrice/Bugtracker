import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { auth } from "@/../auth";
import { MainKanbanBoard, type KanbanIssue } from "./MainKanbanBoard";

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
        <div className="gta-page">
            <div className="gta-hero flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="gta-heading">Main board</h1>
                    <p className="gta-subheading">
                        Drag cards between columns to update status. Use the grip handle so links stay clickable.
                    </p>
                    {!canDrag && (
                        <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                            Sign in to move cards on the board.
                        </p>
                    )}
                </div>
                <Link href="/issues/new" className="gta-action self-start">
                    <Plus className="h-4 w-4" />
                    New issue
                </Link>
            </div>

            <MainKanbanBoard issues={issues} interactive={canDrag} />
        </div>
    );
}
