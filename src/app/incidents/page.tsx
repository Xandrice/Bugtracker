import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import { auth } from "@/../auth";
import { db } from "@/lib/db";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { canManageIncidents, getPermissionContext } from "@/lib/permissions";

export default async function IncidentsPage() {
  const session = await auth();
  const permissions = await getPermissionContext(session?.user?.id);
  const canManage = canManageIncidents(permissions);

  const incidents = await (db as any).incident.findMany({
    orderBy: { updatedAt: "desc" },
    include: { assignee: true, reporter: true },
  });

  return (
    <PageContainer>
      <PageHeader
        title="Incidents"
        description="Track active outages and operational incidents."
        icon={<AlertTriangle className="h-4 w-4" />}
        actions={
          canManage ? (
            <Link
              href="/incidents/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-8 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              New incident
            </Link>
          ) : undefined
        }
      />

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-wider text-subtle-foreground">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Severity</th>
              <th className="px-4 py-2">Assignee</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident: any) => (
              <tr key={incident.id} className="border-b border-border hover:bg-muted/40">
                <td className="px-4 py-3">
                  <Link href={`/incidents/${incident.id}`} className="font-medium hover:text-primary">
                    {incident.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={incident.status === "RESOLVED" ? "success" : "warning"}>
                    {incident.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs">{incident.severity}</td>
                <td className="px-4 py-3 text-xs">
                  {incident.assignee?.name || "Unassigned"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {incidents.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">No incidents recorded.</p>
        )}
      </div>
    </PageContainer>
  );
}
