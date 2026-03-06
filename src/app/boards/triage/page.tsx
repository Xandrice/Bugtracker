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

    const issues: IssueSnippet[] = rawIssues.map(i => ({
        id: i.id,
        title: i.title,
        type: i.type as any,
        status: i.status as any,
        priority: i.priority as any,
        assignee: null,
        updatedAt: i.updatedAt
    }));

    return (
        <div className="flex flex-col h-full p-6 max-w-[1600px] mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">Bug Triage</h1>
                    <p className="text-sm text-muted-foreground">
                        Review and categorize newly reported bugs before assignment.
                    </p>
                </div>
                <Link
                    href="/issues/new"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
                >
                    <Plus className="h-4 w-4" />
                    New Issue
                </Link>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400 p-4 rounded-md text-sm">
                <strong>Triage Goals:</strong> Priority assignment, severity validation, finding duplicates, and component tagging.
            </div>

            <DataGrid issues={issues} />
        </div>
    );
}
