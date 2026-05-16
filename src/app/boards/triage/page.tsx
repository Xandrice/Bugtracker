import { DataGrid, IssueSnippet } from "@/components/views/DataGrid";
import { db } from "@/lib/db";
import Link from "next/link";
import { Plus, AlertTriangle } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { formatIssueRef } from "@/lib/issue-ids";

export default async function BugTriagePage() {
    const rawIssues = await db.issue.findMany({
        where: { assigneeId: null, status: "OPEN" },
        include: {
            parentIssue: { select: { id: true, issueNumber: true } },
            _count: { select: { subtasks: true } },
        },
        orderBy: { updatedAt: "desc" },
    });

    const issues: IssueSnippet[] = rawIssues.map((i: any) => ({
        id: i.id,
        issueNumber: i.issueNumber ?? null,
        title: i.title,
        type: i.type,
        status: i.status,
        priority: i.priority,
        severity: i.severity,
        assignee: null,
        updatedAt: i.updatedAt,
        dueDate: i.dueDate ?? undefined,
        parentIssueRef: i.parentIssue
            ? formatIssueRef(i.parentIssue.issueNumber, i.parentIssue.id)
            : null,
        subtaskCount: i._count?.subtasks ?? 0,
    }));

    return (
        <PageContainer>
            <PageHeader
                title="Triage"
                description="Review and categorize newly reported bugs before assignment."
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
            <Card className="border-warning/30 bg-warning/8">
                <CardBody className="flex items-start gap-2.5 text-xs">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <div>
                        <div className="font-semibold text-foreground">Triage goals</div>
                        <p className="text-muted-foreground">
                            Priority assignment, severity validation, finding duplicates, and component
                            tagging.
                        </p>
                    </div>
                </CardBody>
            </Card>
            <DataGrid issues={issues} />
        </PageContainer>
    );
}
