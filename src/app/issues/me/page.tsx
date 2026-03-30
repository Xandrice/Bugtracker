import { DataGrid, IssueSnippet } from "@/components/views/DataGrid";
import { auth } from "@/../auth";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function MyIssuesPage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect("/api/auth/signin");
    }

    const rawIssues = await db.issue.findMany({
        where: { assigneeId: session.user.id },
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
        <div className="flex flex-col h-full p-6 max-w-[1600px] mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">My Issues</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Issues assigned to you.
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

            <DataGrid issues={issues} />
        </div>
    );
}
