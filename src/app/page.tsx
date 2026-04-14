import { DataGrid, IssueSnippet } from "@/components/views/DataGrid"
import { auth } from "@/../auth"
import Link from "next/link"
import { Plus } from "lucide-react"
import { db } from "@/lib/db"

export default async function Home() {
  const session = await auth()

  const rawIssues = await db.issue.findMany({
    include: { assignee: true },
    orderBy: { updatedAt: 'desc' }
  })

  // Format explicitly as IssueSnippet types
  const issues: IssueSnippet[] = rawIssues.map((i: any) => ({
    id: i.id,
    title: i.title,
    type: i.type as any,
    status: i.status as any,
    priority: i.priority as any,
    severity: i.severity as any,
    assignee: i.assignee ? { id: i.assignee.id, name: i.assignee.name, image: i.assignee.image } : null,
    updatedAt: i.updatedAt
  }));

  return (
    <div className="gta-page">
      <div className="gta-hero flex items-center justify-between gap-4">
        <div>
          <h1 className="gta-heading">Reports</h1>
          <p className="gta-subheading">
            Dispatch board for incoming incidents and development operations.
          </p>
        </div>

        <Link
          href="/issues/new"
          className="gta-action"
        >
          <Plus className="h-4 w-4" />
          File Incident
        </Link>
      </div>

      <DataGrid issues={issues} />
    </div>
  )
}
