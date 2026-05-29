import Link from "next/link";
import { Plus, Shield } from "lucide-react";
import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <PageContainer>
        <PageHeader title="Player reports" icon={<Shield className="h-4 w-4" />} />
        <p className="text-sm text-muted-foreground">Sign in to view the moderation queue.</p>
      </PageContainer>
    );
  }

  const reports = await (db as any).playerReport.findMany({
    orderBy: { updatedAt: "desc" },
    include: { reporter: true, assignee: true },
  });

  return (
    <PageContainer>
      <PageHeader
        title="Player reports"
        description="Moderation queue for player conduct reports."
        icon={<Shield className="h-4 w-4" />}
        actions={
          <Link
            href="/reports/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-8 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            New report
          </Link>
        }
      />

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-wider text-subtle-foreground">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Assignee</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report: any) => (
              <tr key={report.id} className="border-b border-border hover:bg-muted/40">
                <td className="px-4 py-3">
                  <Link href={`/reports/${report.id}`} className="font-medium hover:text-primary">
                    {report.title}
                  </Link>
                  {report.accusedPlayer && (
                    <p className="text-[11px] text-muted-foreground">
                      Accused: {report.accusedPlayer}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">{report.category}</td>
                <td className="px-4 py-3">
                  <Badge tone={report.status === "CLOSED" ? "success" : "warning"}>
                    {report.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs">
                  {report.assignee?.name || "Unassigned"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {reports.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">No reports in queue.</p>
        )}
      </div>
    </PageContainer>
  );
}
