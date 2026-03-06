import { DataGrid, IssueSnippet } from "@/components/views/DataGrid";
import { db } from "@/lib/db";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function BugTriagePage() {
    const rawIssues = await db.issue.findMany({
        where: { assigneeId: null, status: "OPEN" },
        include: { assignee: true },
        orderBy: { updatedAt: 'desc' }
    });

    const issues: IssueSnippet[] = rawIssues.map((i: any) => ({
        id: i.id,
        title: i.title,
        type: i.type as any,
        status: i.status as any,
        priority: i.priority as any,
        assignee: null,
        updatedAt: i.updatedAt,
        dueDate: i.dueDate ?? undefined,
        resourceName: i.resourceName ?? undefined,
        storyPoints: i.storyPoints ?? undefined,
    }));

    return (
        <div className="flex flex-col h-full p-6 max-w-[1600px] mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">Bug Triage</h1>
                    <p className="text-sm text-muted-foreground">
                        Review and categorize newly reported bugs before assignment.
                    </p>
                </div>
                <Link
                    href="/issues/new"
                    className="bg-primary hover:opacity-90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 shadow-md"
                >
                    <Plus className="h-4 w-4" />
                    New Issue
                </Link>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-4 rounded-xl text-sm">
                <strong>Triage Goals:</strong> Priority assignment, severity validation, finding duplicates, and component tagging.
            </div>

            <DataGrid issues={issues} />
        </div>
    );
}
