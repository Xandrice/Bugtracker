import { DataGrid, IssueSnippet } from "@/components/views/DataGrid";
import { auth } from "@/../auth";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { formatIssueRef } from "@/lib/issue-ids";
import { discordSignInUrl } from "@/lib/auth-urls";
import { cn } from "@/components/ui/cn";

export default async function MyIssuesPage({
    searchParams,
}: {
    searchParams: Promise<{ view?: string }>;
}) {
    const session = await auth();
    if (!session?.user?.id) redirect(discordSignInUrl("/issues/me"));

    const params = await searchParams;
    const watchingView = params.view === "watching";

    const rawIssues = await db.issue.findMany({
        where: watchingView
            ? { watchers: { some: { userId: session.user.id } } }
            : { assigneeId: session.user.id },
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
        parentIssueId: i.parentIssueId ?? null,
        parentIssueRef: i.parentIssue
            ? formatIssueRef(i.parentIssue.publicKey, i.parentIssue.id)
            : null,
        subtaskCount: i._count?.subtasks ?? 0,
    }));

    return (
        <PageContainer>
            <PageHeader
                title="My issues"
                description={
                    watchingView
                        ? "Issues you explicitly watch."
                        : "Issues assigned to you."
                }
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
            <div className="flex flex-wrap items-center gap-1.5">
                <Link
                    href="/issues/me"
                    className={cn(
                        "inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                        !watchingView
                            ? "border-primary/40 bg-primary/12 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                >
                    Assigned
                </Link>
                <Link
                    href="/issues/me?view=watching"
                    className={cn(
                        "inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                        watchingView
                            ? "border-primary/40 bg-primary/12 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                >
                    Watching
                </Link>
            </div>
            <DataGrid issues={issues} />
        </PageContainer>
    );
}
