import { DataGrid, IssueSnippet } from "@/components/views/DataGrid";
import { auth } from "@/../auth";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { formatIssueRef } from "@/lib/issue-ids";
import { discordSignInUrl } from "@/lib/auth-urls";

export default async function MyIssuesPage() {
    const session = await auth();
    if (!session?.user?.id) redirect(discordSignInUrl("/issues/me"));

    const rawIssues = await db.issue.findMany({
        where: { assigneeId: session.user.id },
        include: {
            assignee: true,
            parentIssue: { select: { id: true, publicKey: true } },
            _count: { select: { subtasks: true } },
        },
        orderBy: { updatedAt: "desc" },
    });

    const issues: IssueSnippet[] = rawIssues.map((i: any) => ({
        id: i.id,
        publicKey: i.publicKey ?? null,
        title: i.title,
        type: i.type,
        status: i.status,
        priority: i.priority,
        severity: i.severity,
        assignee: i.assignee
            ? { id: i.assignee.id, name: i.assignee.name, image: i.assignee.image }
            : null,
        updatedAt: i.updatedAt,
        dueDate: i.dueDate ?? undefined,
        parentIssueRef: i.parentIssue
            ? formatIssueRef(i.parentIssue.publicKey, i.parentIssue.id)
            : null,
        subtaskCount: i._count?.subtasks ?? 0,
    }));

    return (
        <PageContainer>
            <PageHeader
                title="My issues"
                description="Issues assigned to you."
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
            <DataGrid issues={issues} />
        </PageContainer>
    );
}
