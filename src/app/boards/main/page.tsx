import { KanbanBoard } from "@/components/views/KanbanBoard"
import { IssueSnippet } from "@/components/views/DataGrid"
import { auth } from "@/../auth"
import { db } from "@/lib/db"
import Link from "next/link"
import { Plus } from "lucide-react"

export default async function BoardPage() {
    const session = await auth()

    const rawIssues = await db.issue.findMany({
        include: { assignee: true },
        orderBy: { updatedAt: 'desc' }
    });

    const issues: IssueSnippet[] = rawIssues.map(i => ({
        id: i.id,
        title: i.title,
        type: i.type as any,
        status: i.status as any,
        priority: i.priority as any,
        assignee: i.assignee ? { id: i.assignee.id, name: i.assignee.name, image: i.assignee.image } : null,
        updatedAt: i.updatedAt
    }));

    return (
        <div className="flex flex-col h-full p-6 space-y-4 max-w-[1600px] mx-auto">
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Kanban Board</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Drag and drop issues across different statuses.
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

            <div className="flex-1 min-h-[500px] overflow-hidden">
                <KanbanBoard issues={issues} />
            </div>
        </div>
    )
}
