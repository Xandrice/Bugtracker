import { DataGrid, IssueSnippet } from "@/components/views/DataGrid";
import { auth } from "@/../auth";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { getStaffUsers } from "@/lib/staff";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { formatIssueRef } from "@/lib/issue-ids";
import { canAssignIssues, getPermissionContext } from "@/lib/permissions";

export default async function BacklogIssuesPage() {
    const session = await auth();
    const permissionContext = await getPermissionContext(session?.user?.id);
    const assignableUsers =
        session?.user?.id && canAssignIssues(permissionContext)
            ? await getStaffUsers()
            : [];

    const rawIssues = await db.issue.findMany({
        where: { status: "BACKLOG" },
        include: {
            assignee: true,
            parentIssue: { select: { id: true, publicKey: true } },
            _count: { select: { subtasks: true } },
        },
        orderBy: { updatedAt: "desc" },
    });

    const issues: IssueSnippet[] = rawIssues.map((i) => ({
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
        resourceName: i.resourceName ?? undefined,
        storyPoints: i.storyPoints ?? undefined,
        parentIssueRef: i.parentIssue
            ? formatIssueRef(i.parentIssue.publicKey, i.parentIssue.id)
            : null,
        subtaskCount: i._count?.subtasks ?? 0,
    }));

    return (
        <PageContainer>
            <PageHeader
                title="Backlog"
                description="Lower-priority work that is parked outside active todo and triage queues."
                actions={
                    session?.user?.id && (
                        <Link
                            href="/issues/new"
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-8 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            New issue
                        </Link>
                    )
                }
            />
            <DataGrid issues={issues} assignableUsers={assignableUsers} />
        </PageContainer>
    );
}
