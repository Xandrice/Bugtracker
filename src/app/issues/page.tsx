import { DataGrid, IssueSnippet } from "@/components/views/DataGrid";
import { auth } from "@/../auth";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";

export default async function AllIssuesPage() {
    const session = await auth();

    const rawIssues = await db.issue.findMany({
        include: { assignee: true },
        orderBy: { updatedAt: 'desc' }
    });

    const issues: IssueSnippet[] = rawIssues.map((i: any) => ({
        id: i.id,
        title: i.title,
        type: i.type as any,
        status: i.status as any,
        priority: i.priority as any,
        severity: i.severity as any,
        assignee: i.assignee ? { id: i.assignee.id, name: i.assignee.name, image: i.assignee.image } : null,
        updatedAt: i.updatedAt,
        dueDate: i.dueDate ?? undefined,
        resourceName: i.resourceName ?? undefined,
        storyPoints: i.storyPoints ?? undefined,
    }));

    return (
        <div className="gta-page">
            <div className="gta-hero flex items-center justify-between gap-4">
                <div>
                    <h1 className="gta-heading">All Cases</h1>
                    <p className="gta-subheading">
                        Bugs, features, and tasks for your FiveM server.
                    </p>
                </div>

                {session?.user?.id && (
                    <Link
                        href="/issues/new"
                        className="gta-action"
                    >
                        <Plus className="h-4 w-4" />
                        New Issue
                    </Link>
                )}
            </div>

            <DataGrid issues={issues} />
        </div>
    );
}
