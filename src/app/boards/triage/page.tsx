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
        issueNumber: i.issueNumber ?? null,
        title: i.title,
        type: i.type as any,
        status: i.status as any,
        priority: i.priority as any,
        severity: i.severity as any,
        assignee: null,
        updatedAt: i.updatedAt,
        dueDate: i.dueDate ?? undefined,
        resourceName: i.resourceName ?? undefined,
        storyPoints: i.storyPoints ?? undefined,
    }));

    return (
        <div className="gta-page">
            <div className="gta-hero flex items-center justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="gta-heading">Triage Board</h1>
                    <p className="gta-subheading">
                        Review and categorize newly reported bugs before assignment.
                    </p>
                </div>
                <Link
                    href="/issues/new"
                    className="gta-action"
                >
                    <Plus className="h-4 w-4" />
                    New Issue
                </Link>
            </div>

            <div className="gta-surface bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 p-4 text-sm">
                <strong>Triage Goals:</strong> Priority assignment, severity validation, finding duplicates, and component tagging.
            </div>

            <DataGrid issues={issues} />
        </div>
    );
}
