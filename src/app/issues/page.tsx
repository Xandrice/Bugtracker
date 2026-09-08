import { IssueListView } from "@/components/issues/IssueListView";
import type { IssueListParams } from "@/lib/issue-list-state";
import { auth } from "@/../auth";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ALL_ISSUES_SUBTITLE } from "@/lib/site";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";

export default async function AllIssuesPage({ searchParams }: { searchParams: Promise<IssueListParams> }) {
    const session = await auth();
    const params = await searchParams;

    return (
        <PageContainer>
            <PageHeader
                title="All issues"
                description={ALL_ISSUES_SUBTITLE}
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
            <IssueListView params={params} scope="all" />
        </PageContainer>
    );
}
